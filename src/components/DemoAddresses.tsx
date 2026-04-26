'use client';

import { useState } from 'react';
import { autocomplete, type GeoResult } from '@/lib/geosearch';

type Props = {
  onSelect: (result: GeoResult) => void;
  disabled?: boolean;
};

const DEMO_ADDRESSES: { full: string; tag: string; hint: string }[] = [
  { full: '350 West 50th Street, Manhattan',  tag: '350 W 50th',  hint: 'Hell’s Kitchen — pre-war' },
  { full: '207 West 106th Street, Manhattan', tag: '207 W 106th', hint: 'Upper West Side — UWS' },
  { full: '165 East 35th Street, Manhattan',  tag: '165 E 35th',  hint: 'Murray Hill — mid-rise' },
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
        setError(`Couldn't resolve "${query}".`);
        return;
      }
      onSelect(match);
    } finally {
      setLoadingAddr(null);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="eyebrow">Or try one</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {DEMO_ADDRESSES.map((d) => {
          const isLoading = loadingAddr === d.full;
          return (
            <button
              key={d.full}
              type="button"
              onClick={() => handleClick(d.full)}
              disabled={disabled || loadingAddr !== null}
              className="group flex flex-col items-start gap-0.5 rounded-[10px] border border-rule bg-bone px-3 py-2.5 text-left transition-all hover:border-brass hover:bg-brass-wash hover:-translate-y-px hover:shadow-[0_8px_20px_-12px_rgba(176,122,26,0.4)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="font-display text-sm font-semibold text-ink-text group-hover:text-brass-deep">
                {isLoading ? 'Loading…' : d.tag}
              </span>
              <span className="text-[11px] text-muted leading-tight">{d.hint}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-rust">{error}</p>}
    </div>
  );
}
