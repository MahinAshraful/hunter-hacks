'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type LngLatLike } from 'maplibre-gl';

export type MapStatus = 'idle' | 'flying' | 'arrived';

type Target = {
  lat: number;
  lng: number;
  address: string;
  bbl?: string;
  bin?: string;
};

type Props = {
  target: Target | null;
  onStatusChange?: (status: MapStatus) => void;
  className?: string;
};

const NYC_CENTER: [number, number] = [-73.97, 40.76];
const GLOBE_CENTER: [number, number] = [-50, 30];
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const HIGHLIGHT_FILL = '#f5c25c';
const HIGHLIGHT_FILL_DEEP = '#e6a838';
const HIGHLIGHT_FOOTPRINT = '#fff1bd';
const BUILDING_FILL = '#a89169';
const BUILDING_FILL_TOP = '#d4b88a';

const NYC_FOOTPRINTS_URL =
  'https://data.cityofnewyork.us/resource/5zhs-2jue.geojson';

// ──────────────────────────────────────────────────────────────────────
// Geometry helpers (avoid pulling in turf — these are tiny and tight)
// ──────────────────────────────────────────────────────────────────────

type LngLat = [number, number];

function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(p: LngLat, polygon: LngLat[][]): boolean {
  if (!polygon.length || !pointInRing(p, polygon[0])) return false;
  // Check holes — point must NOT be in any hole
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(p, polygon[i])) return false;
  }
  return true;
}

function pointInGeometry(p: LngLat, g: GeoJSON.Geometry): boolean {
  if (!g) return false;
  if (g.type === 'Polygon') return pointInPolygon(p, g.coordinates as LngLat[][]);
  if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates as LngLat[][][]) {
      if (pointInPolygon(p, poly)) return true;
    }
    return false;
  }
  return false;
}

function ringCentroidWeighted(ring: LngLat[]): { x: number; y: number; area: number } {
  // Shoelace centroid — works for simple polygons
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const f = xj * yi - xi * yj;
    area += f;
    cx += (xj + xi) * f;
    cy += (yj + yi) * f;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) {
    // Degenerate — average vertices
    cx = ring.reduce((a, p) => a + p[0], 0) / Math.max(ring.length, 1);
    cy = ring.reduce((a, p) => a + p[1], 0) / Math.max(ring.length, 1);
    return { x: cx, y: cy, area: 0 };
  }
  return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
}

function geometryCentroid(g: GeoJSON.Geometry): LngLat | null {
  if (!g) return null;
  if (g.type === 'Polygon') {
    const c = ringCentroidWeighted((g.coordinates as LngLat[][])[0] ?? []);
    return [c.x, c.y];
  }
  if (g.type === 'MultiPolygon') {
    // Area-weighted average across rings
    let totalArea = 0, cx = 0, cy = 0;
    for (const poly of g.coordinates as LngLat[][][]) {
      const ring = poly[0] ?? [];
      const c = ringCentroidWeighted(ring);
      cx += c.x * c.area;
      cy += c.y * c.area;
      totalArea += c.area;
    }
    if (totalArea === 0) return null;
    return [cx / totalArea, cy / totalArea];
  }
  return null;
}

function distSq(a: LngLat, b: LngLat): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

// ──────────────────────────────────────────────────────────────────────
// Polygon buffer (offset outward by N meters)
//
// Why: when we render the brass highlight as a fill-extrusion, its walls
// sit at the BIN footprint. The OMT base extrusion's walls sit at OSM's
// (slightly different) footprint. Where the two coincide or overlap,
// WebGL z-fights — the symptoms are exactly what we saw: random patches
// where neither wins, sometimes top, sometimes bottom, sometimes nothing.
// Buffering the brass polygon outward by ~0.8m makes its walls lie
// strictly outside the OMT walls, eliminating the conflict entirely.
//
// Algorithm: bisector-normal offset with a miter limit. For each vertex,
// take the unit outward normals of its two adjacent edges, sum them to
// form a bisector, and move the vertex along the bisector by
// `offset / cos(half-angle)`. Sharp corners get clamped (miter limit) to
// avoid spikes.
// ──────────────────────────────────────────────────────────────────────

const M_PER_DEG_LAT = 111_000;

function bufferRing(ring: LngLat[], offsetMeters: number): LngLat[] {
  if (ring.length < 4) return ring;

  const closed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring;
  const n = open.length;
  if (n < 3) return ring;

  const centerLat = open.reduce((s, p) => s + p[1], 0) / n;
  const lngScale = Math.cos((centerLat * Math.PI) / 180);
  const M_LNG = M_PER_DEG_LAT * lngScale;

  // Project to local meter coords for the offset math
  const xy: [number, number][] = open.map((p) => [p[0] * M_LNG, p[1] * M_PER_DEG_LAT]);

  // Determine winding via signed shoelace
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % n];
    signedArea += a[0] * b[1] - b[0] * a[1];
  }
  // signedArea > 0 = CCW (standard math convention with y pointing up).
  // GeoJSON RFC 7946 specifies outer rings CCW, holes CW. The CALLER
  // negates `offsetMeters` for inner rings so this routine can treat
  // every ring as if it should expand outward.
  const sign = signedArea >= 0 ? 1 : -1;

  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = xy[(i - 1 + n) % n];
    const cur = xy[i];
    const next = xy[(i + 1) % n];

    const e1x = cur[0] - prev[0], e1y = cur[1] - prev[1];
    const e2x = next[0] - cur[0], e2y = next[1] - cur[1];

    // Outward normal for CCW: (dy, -dx). Flip via `sign` if the ring is CW.
    const n1x = e1y * sign, n1y = -e1x * sign;
    const n2x = e2y * sign, n2y = -e2x * sign;

    const l1 = Math.hypot(n1x, n1y) || 1;
    const l2 = Math.hypot(n2x, n2y) || 1;
    const u1x = n1x / l1, u1y = n1y / l1;
    const u2x = n2x / l2, u2y = n2y / l2;

    const bx = u1x + u2x;
    const by = u1y + u2y;
    const lb = Math.hypot(bx, by);

    if (lb < 1e-9) {
      // Reflex / 180° turn — fall back to one normal
      out.push([cur[0] + u1x * offsetMeters, cur[1] + u1y * offsetMeters]);
      continue;
    }
    const bxn = bx / lb, byn = by / lb;
    const cosHalf = u1x * bxn + u1y * byn;
    // Miter limit: cap at 4× to avoid huge spikes at acute corners
    const miter = Math.min(offsetMeters / Math.max(cosHalf, 0.25), Math.abs(offsetMeters) * 4);
    out.push([cur[0] + bxn * miter, cur[1] + byn * miter]);
  }

  // Convert back to lng/lat and re-close
  const result: LngLat[] = out.map((p) => [p[0] / M_LNG, p[1] / M_PER_DEG_LAT]);
  result.push(result[0]);
  return result;
}

function bufferPolygonCoords(poly: LngLat[][], offsetMeters: number): LngLat[][] {
  return poly.map((ring, i) => bufferRing(ring, i === 0 ? offsetMeters : -offsetMeters));
}

function bufferGeometry(g: GeoJSON.Geometry, offsetMeters: number): GeoJSON.Geometry {
  if (!g) return g;
  if (g.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: bufferPolygonCoords(g.coordinates as LngLat[][], offsetMeters) as never,
    };
  }
  if (g.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: (g.coordinates as LngLat[][][]).map((p) =>
        bufferPolygonCoords(p, offsetMeters),
      ) as never,
    };
  }
  return g;
}

// Combine all rendered tile features that reference the same building
// into one geometry. For OpenMapTiles' building layer this isn't perfect
// but is a reasonable union for visual purposes.
function combineToFeature(features: GeoJSON.Feature[]): GeoJSON.Feature | null {
  if (!features.length) return null;
  if (features.length === 1) {
    return features[0] as GeoJSON.Feature;
  }
  const allPolys: LngLat[][][] = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      allPolys.push(g.coordinates as LngLat[][]);
    } else if (g.type === 'MultiPolygon') {
      for (const p of g.coordinates as LngLat[][][]) allPolys.push(p);
    }
  }
  if (!allPolys.length) return features[0] as GeoJSON.Feature;
  const merged: GeoJSON.Feature = {
    type: 'Feature',
    properties: features[0].properties ?? {},
    geometry: { type: 'MultiPolygon', coordinates: allPolys as never },
  };
  return merged;
}

// ──────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────

export default function CityMap3D({ target, onStatusChange, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const styleReadyRef = useRef(false);
  const targetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const slowSpinRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  // Footprint pre-fetched by BIN, keyed to the current target
  const cachedFootprintRef = useRef<{
    bin: string;
    feature: GeoJSON.Feature;
  } | null>(null);
  const [, force] = useState(0);

  // ── init map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: GLOBE_CENTER,
      zoom: 1.6,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
      maxPitch: 80,
      ...({ antialias: true } as Record<string, unknown>),
    } as ConstructorParameters<typeof maplibregl.Map>[0]);

    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right',
    );

    map.on('styleimagemissing', (e) => {
      const id = e.id;
      if (!id || map.hasImage(id)) return;
      const blank = new Uint8Array(4);
      try { map.addImage(id, { width: 1, height: 1, data: blank }); } catch { /* ignore */ }
    });

    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => {
        if (mapRef.current) requestAnimationFrame(() => mapRef.current?.resize());
      });
      obs.observe(containerRef.current);
      resizeObsRef.current = obs;
    }
    const r1 = window.setTimeout(() => mapRef.current?.resize(), 50);
    const r2 = window.setTimeout(() => mapRef.current?.resize(), 250);
    const r3 = window.setTimeout(() => mapRef.current?.resize(), 800);
    const onWinResize = () => mapRef.current?.resize();
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onWinResize);

    map.on('load', () => {
      try {
        const m = map as unknown as { setProjection?: (p: { type: string }) => void };
        m.setProjection?.({ type: 'globe' });
      } catch { /* ignore */ }

      try {
        const m = map as unknown as { setFog?: (f: Record<string, unknown>) => void };
        m.setFog?.({
          range: [0.8, 8],
          color: '#1a1f2a',
          'horizon-blend': 0.2,
          'high-color': '#c8a878',
          'space-color': '#0c0f17',
          'star-intensity': 0.55,
        });
      } catch { /* ignore */ }

      // Slow globe spin while idle
      const spin = () => {
        if (!mapRef.current || userInteractedRef.current) return;
        const m = mapRef.current;
        const center = m.getCenter();
        center.lng -= 0.06;
        m.easeTo({ center, duration: 60, easing: (t) => t });
        slowSpinRef.current = window.setTimeout(spin, 60);
      };
      slowSpinRef.current = window.setTimeout(spin, 600);

      attachBuildingLayers(map);
      styleReadyRef.current = true;
      force((v) => v + 1);
    });

    const stopSpin = () => {
      userInteractedRef.current = true;
      if (slowSpinRef.current) {
        clearTimeout(slowSpinRef.current);
        slowSpinRef.current = null;
      }
    };
    map.on('mousedown', stopSpin);
    map.on('wheel', stopSpin);
    map.on('touchstart', stopSpin);
    map.on('dragstart', stopSpin);

    return () => {
      if (slowSpinRef.current) clearTimeout(slowSpinRef.current);
      clearTimeout(r1);
      clearTimeout(r2);
      clearTimeout(r3);
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── pre-fetch building footprint by BIN as soon as a target is picked
  // (runs in parallel with the camera flight, so the highlight is ready
  // the instant the camera lands)
  useEffect(() => {
    cachedFootprintRef.current = null;
    if (!target?.bin) return;
    const bin = target.bin;
    const ctrl = new AbortController();
    (async () => {
      try {
        const url = `${NYC_FOOTPRINTS_URL}?bin=${encodeURIComponent(bin)}&$limit=20`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const fc = (await res.json()) as GeoJSON.FeatureCollection;
        if (!fc.features?.length) return;
        // Combine multiple footprints into one feature (large complexes
        // sometimes have one BIN with several roof-height polygons)
        const combined = combineToFeature(fc.features);
        if (combined) cachedFootprintRef.current = { bin, feature: combined };
      } catch { /* swallow — fallback path will kick in */ }
    })();
    return () => ctrl.abort();
  }, [target?.bin]);

  // ── fly to target ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !target) return;

    userInteractedRef.current = true;
    if (slowSpinRef.current) {
      clearTimeout(slowSpinRef.current);
      slowSpinRef.current = null;
    }

    onStatusChange?.('flying');

    const dest: [number, number] = [target.lng, target.lat];

    map.flyTo({
      center: NYC_CENTER as LngLatLike,
      zoom: 11.8,
      pitch: 28,
      bearing: 0,
      duration: 2200,
      essential: true,
      curve: 1.5,
    });

    const t1 = window.setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.flyTo({
        center: dest as LngLatLike,
        zoom: 18.6,        // a touch closer
        pitch: 62,         // architectural without distorting where center IS
        bearing: 0,        // north-up — no rotation, address sits dead-center
        duration: 3600,
        essential: true,
        curve: 1.6,
        speed: 0.85,
      });
    }, 2000);

    const arriveHandler = () => {
      const m = mapRef.current;
      if (!m) return;

      // Pin goes at the EXACT GeoSearch lat/lng — that's the most
      // accurate point we have for the address. We never move it to a
      // building centroid (a wrong-building resolution would otherwise
      // drag the pin away from the actual address).
      placePin(m, dest as LngLatLike, targetMarkerRef);

      const runHighlight = () => {
        const feature = resolveBuildingFeature(m, target, cachedFootprintRef.current);
        applyHighlight(m, feature);
        onStatusChange?.('arrived');
      };

      try {
        // areTilesLoaded() returns true when nothing is pending
        const a = m as unknown as { areTilesLoaded?: () => boolean };
        if (a.areTilesLoaded?.() ?? true) {
          runHighlight();
        } else {
          let done = false;
          const onIdle = () => {
            if (done) return;
            done = true;
            runHighlight();
          };
          m.once('idle', onIdle);
          // Hard cap so we never hang
          window.setTimeout(onIdle, 1500);
        }
      } catch {
        runHighlight();
      }
    };

    const t2 = window.setTimeout(arriveHandler, 2000 + 3300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, target?.bin]);

  // ── reset to globe when target cleared ───────────────────────────────
  useEffect(() => {
    if (target) return;
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
      targetMarkerRef.current = null;
    }
    clearHighlight(map);
    map.flyTo({
      center: GLOBE_CENTER as LngLatLike,
      zoom: 1.6,
      pitch: 0,
      bearing: 0,
      duration: 1800,
      curve: 1.4,
    });
    onStatusChange?.('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div className={className ?? 'absolute inset-0'}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
      <style jsx global>{`
        .maplibregl-map,
        .maplibregl-canvas-container,
        .maplibregl-canvas {
          width: 100% !important;
          height: 100% !important;
        }
        .ledger-marker {
          position: relative;
          width: 34px;
          height: 42px;
          pointer-events: none;
        }
        .ledger-marker-pin {
          position: relative;
          z-index: 3;
          filter: drop-shadow(0 6px 14px rgba(0,0,0,0.55));
          animation: pinDrop 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }
        .ledger-marker-pulse {
          position: absolute;
          left: 50%;
          bottom: -3px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(245, 194, 92, 0.95);
          transform: translate(-50%, 0);
          box-shadow: 0 0 12px 3px rgba(245, 194, 92, 0.5);
          z-index: 2;
          animation: markerPulse 2.2s ease-out infinite;
        }
        .ledger-marker-beam {
          position: absolute;
          left: 50%;
          bottom: 6px;
          width: 4px;
          height: 220px;
          transform: translate(-50%, 0);
          background: linear-gradient(to top, rgba(245, 194, 92, 0.55), rgba(245, 194, 92, 0));
          filter: blur(2px);
          z-index: 1;
          animation: beamPulse 2.6s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes pinDrop {
          0%   { transform: translateY(-46px); opacity: 0; }
          80%  { transform: translateY(2px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes markerPulse {
          0%   { box-shadow: 0 0 0 0 rgba(245, 194, 92, 0.55), 0 0 12px 3px rgba(245, 194, 92, 0.5); transform: translate(-50%, 0) scale(1); }
          70%  { box-shadow: 0 0 0 24px rgba(245, 194, 92, 0), 0 0 12px 3px rgba(245, 194, 92, 0.5); transform: translate(-50%, 0) scale(1.4); }
          100% { box-shadow: 0 0 0 0 rgba(245, 194, 92, 0), 0 0 12px 3px rgba(245, 194, 92, 0.5); transform: translate(-50%, 0) scale(1); }
        }
        @keyframes beamPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Map setup helpers
// ──────────────────────────────────────────────────────────────────────

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function attachBuildingLayers(map: MLMap) {
  const style = map.getStyle();
  if (!style) return;

  let firstSymbolId: string | undefined;
  for (const layer of style.layers ?? []) {
    if (layer.type === 'symbol') {
      firstSymbolId = layer.id;
      break;
    }
  }

  try {
    if (style.layers?.find((l) => l.id === 'background')) {
      map.setPaintProperty('background', 'background-color', '#13171f');
    }
  } catch { /* ignore */ }

  // Hide the default building layers from the underlying style
  for (const id of ['building', 'building-top', 'building-3d']) {
    if (style.layers?.find((l) => l.id === id)) {
      try { map.setLayoutProperty(id, 'visibility', 'none'); } catch { /* ignore */ }
    }
  }

  const sourceId =
    Object.keys(style.sources ?? {}).find((id) =>
      ['openmaptiles', 'composite', 'omt'].includes(id),
    ) ?? Object.keys(style.sources ?? {})[0];
  if (!sourceId) return;

  // Base 3D extrusion — every building, warm sandstone
  if (!map.getLayer('ledger-buildings-3d')) {
    map.addLayer(
      {
        id: 'ledger-buildings-3d',
        source: sourceId,
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'render_height'],
            0,   BUILDING_FILL,
            40,  '#b89569',
            120, '#9c8052',
            240, BUILDING_FILL_TOP,
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            13, 0,
            14.5, ['coalesce', ['get', 'render_height'], 8],
            18, ['coalesce', ['get', 'render_height'], 8],
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      firstSymbolId,
    );
  }

  // Two sources: one for the brass volume (polygon inflated +0.8m),
  // one for the ground halo (polygon inflated +6m so it visibly spills
  // out around the base of the building).
  if (!map.getSource('ledger-target')) {
    map.addSource('ledger-target', { type: 'geojson', data: EMPTY_FC });
  }
  if (!map.getSource('ledger-target-halo')) {
    map.addSource('ledger-target-halo', { type: 'geojson', data: EMPTY_FC });
  }

  // Ground halo — sits underneath the OMT extrusions so the brass
  // building can rise out of a creamy spotlight on the pavement.
  if (!map.getLayer('ledger-target-fill')) {
    map.addLayer(
      {
        id: 'ledger-target-fill',
        source: 'ledger-target-halo',
        type: 'fill',
        minzoom: 13,
        paint: {
          'fill-color': HIGHLIGHT_FOOTPRINT,
          'fill-opacity': 0.55,
          'fill-outline-color': HIGHLIGHT_FILL_DEEP,
        },
      },
      'ledger-buildings-3d',
    );
  }

  // The highlighted building extruded in brass. Sits ABOVE the base
  // 3D buildings and is BOTH taller (+8m absolute) AND wider (~0.8m
  // outward buffer applied at apply-time) than the OMT building, so it
  // FULLY ENCLOSES the OMT volume. Without this, coplanar walls + roofs
  // z-fight against the OMT extrusion and you get random patches of
  // sandstone bleeding through.
  if (!map.getLayer('ledger-target-extrusion')) {
    map.addLayer(
      {
        id: 'ledger-target-extrusion',
        source: 'ledger-target',
        type: 'fill-extrusion',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': HIGHLIGHT_FILL,
          'fill-extrusion-height': [
            '+',
            8, // always 8m taller than the underlying OMT/heightroof
            [
              'coalesce',
              ['get', '_render_height'],
              ['get', 'render_height'],
              ['*', 0.3048, ['to-number', ['get', 'heightroof'], 0]],
              16,
            ],
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': false,
        },
      },
      firstSymbolId,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Highlight resolution
// ──────────────────────────────────────────────────────────────────────

function resolveBuildingFeature(
  m: MLMap,
  target: Target,
  cached: { bin: string; feature: GeoJSON.Feature } | null,
): GeoJSON.Feature | null {
  // 1. Authoritative path: NYC OpenData footprint by BIN.
  if (cached && target.bin && cached.bin === target.bin) {
    return enrichHeightFromTiles(m, cached.feature);
  }

  // 2. Fallback: query rendered building features around the address
  //    point and find the one that GEOMETRICALLY contains it (or, if
  //    the address geocoded to the sidewalk, the closest one).
  try {
    const dest: LngLat = [target.lng, target.lat];
    const point = m.project(dest as LngLatLike);
    // 60-px box at z18 ≈ 18m — wide enough to catch the building even
    // if the address geocoded a few meters away.
    const radius = 60;
    const features = m.queryRenderedFeatures(
      [
        [point.x - radius, point.y - radius],
        [point.x + radius, point.y + radius],
      ],
      { layers: ['ledger-buildings-3d'] },
    ) as unknown as GeoJSON.Feature[];

    if (!features.length) return null;

    // Group by source-layer feature id — but since the same building
    // can exist in multiple tiles with different ids, we instead
    // dedupe by approximate centroid (1e-5 deg ≈ 1m precision).
    const buckets = new Map<string, GeoJSON.Feature[]>();
    for (const f of features) {
      const c = geometryCentroid(f.geometry);
      if (!c) continue;
      const key = `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
      const arr = buckets.get(key) ?? [];
      arr.push(f);
      buckets.set(key, arr);
    }
    const candidates: GeoJSON.Feature[] = [];
    for (const arr of buckets.values()) {
      const merged = combineToFeature(arr);
      if (merged) candidates.push(merged);
    }

    // Prefer a candidate whose polygon CONTAINS the address point
    for (const cand of candidates) {
      if (pointInGeometry(dest, cand.geometry)) return cand;
    }

    // Otherwise, the closest by centroid (shoelace-weighted)
    let best: GeoJSON.Feature | null = null;
    let bestD = Infinity;
    for (const cand of candidates) {
      const c = geometryCentroid(cand.geometry);
      if (!c) continue;
      const d = distSq(c, dest);
      if (d < bestD) {
        bestD = d;
        best = cand;
      }
    }
    return best;
  } catch {
    return null;
  }
}

// The NYC OpenData footprint is the gold-standard polygon but often
// has no height. Sample the underlying OMT building's render_height
// at the centroid + a few interior probe points and use the tallest.
function enrichHeightFromTiles(m: MLMap, feature: GeoJSON.Feature): GeoJSON.Feature {
  const c = geometryCentroid(feature.geometry);
  if (!c) return feature;
  let bestH = 0;
  try {
    const probe = (lng: number, lat: number) => {
      const p = m.project([lng, lat] as LngLatLike);
      const fs = m.queryRenderedFeatures(
        [[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]],
        { layers: ['ledger-buildings-3d'] },
      );
      for (const f of fs) {
        const h = (f.properties as { render_height?: number })?.render_height ?? 0;
        if (h > bestH) bestH = h;
      }
    };
    // Centroid + small offsets (~3m) to handle off-centroid buildings
    probe(c[0], c[1]);
    probe(c[0] + 0.00003, c[1]);
    probe(c[0] - 0.00003, c[1]);
    probe(c[0], c[1] + 0.00002);
    probe(c[0], c[1] - 0.00002);
  } catch { /* ignore */ }
  if (bestH <= 0) return feature;
  return {
    ...feature,
    properties: { ...(feature.properties || {}), _render_height: bestH },
  };
}

function applyHighlight(m: MLMap, feature: GeoJSON.Feature | null) {
  const brass = m.getSource('ledger-target') as maplibregl.GeoJSONSource | undefined;
  const halo = m.getSource('ledger-target-halo') as maplibregl.GeoJSONSource | undefined;
  if (!brass || !halo) return;
  if (!feature) {
    brass.setData(EMPTY_FC);
    halo.setData(EMPTY_FC);
    return;
  }
  // Inflate the polygon by 0.8m for the brass building so its walls sit
  // clearly outside the OMT walls (eliminates z-fighting).
  const brassFeature: GeoJSON.Feature = {
    ...feature,
    geometry: bufferGeometry(feature.geometry, 0.8),
  };
  // Inflate by 6m for the ground halo so it spills visibly out from the
  // base of the brass building like a spotlight on the pavement.
  const haloFeature: GeoJSON.Feature = {
    ...feature,
    geometry: bufferGeometry(feature.geometry, 6),
  };
  brass.setData({ type: 'FeatureCollection', features: [brassFeature] });
  halo.setData({ type: 'FeatureCollection', features: [haloFeature] });
}

function clearHighlight(m: MLMap) {
  (m.getSource('ledger-target') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
  (m.getSource('ledger-target-halo') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
}

// ──────────────────────────────────────────────────────────────────────
// Pin
// ──────────────────────────────────────────────────────────────────────

function placePin(
  m: MLMap,
  lngLat: LngLatLike,
  ref: React.MutableRefObject<maplibregl.Marker | null>,
) {
  if (ref.current) ref.current.remove();
  const el = document.createElement('div');
  el.className = 'ledger-marker';
  el.innerHTML = `
    <div class="ledger-marker-beam"></div>
    <div class="ledger-marker-pulse"></div>
    <div class="ledger-marker-pin">
      <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lmg" x1="17" y1="0" x2="17" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ffd070"/>
            <stop offset="1" stop-color="#b07a1a"/>
          </linearGradient>
        </defs>
        <path d="M17 2c7.732 0 14 5.82 14 13 0 9.5-14 25-14 25S3 24.5 3 15C3 7.82 9.268 2 17 2z"
          fill="url(#lmg)" stroke="#1a1305" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="17" cy="15" r="4.5" fill="#1a1305"/>
        <circle cx="17" cy="15" r="2" fill="#ffd070"/>
      </svg>
    </div>
  `;
  ref.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat(lngLat)
    .addTo(m);
}
