'use client';

import { useState } from 'react';
import { autocomplete, type GeoResult } from '@/lib/geosearch';

type Props = {
  onSelect: (result: GeoResult) => void;
  disabled?: boolean;
};

// Pre-war Manhattan rental addresses we expect to surface in the NYCDB
// rentstab seed. If a chosen address doesn't resolve to a stabilized
// building in the local DB during a demo, swap it for one that does.
const DEMO_ADDRESSES = [
  '350 West 50th Street, Manhattan',
  '207 West 106th Street, Manhattan',
  '165 East 35th Street, Manhattan',
];

export default function DemoAddresses({ onSelect, disabled }: Props) {
  const [loadingAddr, setLoadingAddr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(query: string) {
    setError(null);
    setLoadingAddr(query);
    try {
      const results = await autocomplete(query);
      const match = results[0];
      if (!match) {
        setError(`Couldn't resolve "${query}" — try typing it manually.`);
        return;
      }
      onSelect(match);
    } finally {
      setLoadingAddr(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-500">Try a demo address:</span>
      {DEMO_ADDRESSES.map((addr) => {
        const isLoading = loadingAddr === addr;
        const short = addr.replace(', Manhattan', '');
        return (
          <button
            key={addr}
            type="button"
            onClick={() => handleClick(addr)}
            disabled={disabled || loadingAddr !== null}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 font-medium text-gray-700 shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : short}
          </button>
        );
      })}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
