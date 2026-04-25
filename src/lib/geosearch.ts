export type GeoResult = {
  label: string;
  bbl: string;
  lat: number;
  lng: number;
};

type GeoFeature = {
  properties: {
    label: string;
    addendum?: {
      pad?: {
        bbl?: string;
      };
    };
  };
  geometry: {
    coordinates: [number, number];
  };
};

export async function autocomplete(text: string): Promise<GeoResult[]> {
  try {
    if (text.trim().length < 3) return [];

    const url = `https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(text.trim())}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const json = (await res.json()) as { features?: GeoFeature[] };
    if (!json.features) return [];

    return json.features
      .filter((f) => f.properties.addendum?.pad?.bbl)
      .map((f) => ({
        label: f.properties.label,
        bbl: f.properties.addendum!.pad!.bbl!,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
  } catch {
    return [];
  }
}
