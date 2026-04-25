'use client';

import { useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';

type Props = {
  lat: number;
  lng: number;
  address: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function MapModal({ lat, lng, address, isOpen, onClose }: Props) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl rounded-2xl bg-surface shadow-2xl overflow-hidden animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-primary truncate pr-4">{address}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
            aria-label="Close map"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-[70vh] max-h-[500px]">
          <MapContainer
            center={[lat, lng]}
            zoom={17}
            scrollWheelZoom={true}
            zoomControl={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <CircleMarker
              center={[lat, lng]}
              radius={10}
              pathOptions={{
                color: '#b45309',
                fillColor: '#b45309',
                fillOpacity: 0.8,
                weight: 2,
              }}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
