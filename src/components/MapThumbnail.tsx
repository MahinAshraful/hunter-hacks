'use client';

import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';

type Props = {
  lat: number;
  lng: number;
  address: string;
  onClick: () => void;
};

export default function MapThumbnail({ lat, lng, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block w-full overflow-hidden rounded-xl border border-border shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      <div className="h-48 w-full">
        <MapContainer
          center={[lat, lng]}
          zoom={17}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          zoomControl={false}
          attributionControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CircleMarker
            center={[lat, lng]}
            radius={8}
            pathOptions={{
              color: '#b45309',
              fillColor: '#b45309',
              fillOpacity: 0.8,
              weight: 2,
            }}
          />
        </MapContainer>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
        <span className="text-xs font-medium text-white opacity-80 group-hover:opacity-100 transition-opacity">
          Click to expand map
        </span>
      </div>
    </button>
  );
}
