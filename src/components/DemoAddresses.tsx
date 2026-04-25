'use client';

import { useState } from 'react';
import { autocomplete, type GeoResult } from '@/lib/geosearch';

type Props = {
  onSelect: (result: GeoResult) => void;
  disabled?: boolean;
};

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
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
      <span className="text-secondary">Try a demo address:</span>
      {DEMO_ADDRESSES.map((addr) => {
        const isLoading = loadingAddr === addr;
        const short = addr.replace(', Manhattan', '');
        return (
          <button
            key={addr}
            type="button"
            onClick={() => handleClick(addr)}
            disabled={disabled || loadingAddr !== null}
            className="rounded-full border border-border bg-surface px-3 py-1 font-medium text-secondary shadow-sm transition-colors duration-150 hover:border-accent hover:bg-accent-surface hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : short}
          </button>
        );
      })}
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}
