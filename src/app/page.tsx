'use client';

import { useState } from 'react';
import AddressSearch from '@/components/AddressSearch';
import ResultCard from '@/components/ResultCard';
import type { GeoResult } from '@/lib/geosearch';
import type { Verdict } from '@/lib/stabilization';

export default function Home() {
  const [selectedResult, setSelectedResult] = useState<GeoResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(result: GeoResult) {
    setSelectedResult(result);
    setVerdict(null);
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbl: result.bbl, address: result.label }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errorBody.error ?? `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as Verdict;
      setVerdict(data);
    } catch (err) {
      console.error('Lookup failed:', err);
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          NYC Rent Stabilization Lookup
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Search for any NYC address to check whether the building has rent-stabilized units.
        </p>

        <div className="mt-8">
          <AddressSearch onSelect={handleSelect} disabled={isLoading} />
        </div>

        {isLoading && (
          <p className="mt-4 text-sm text-gray-400">Looking up stabilization status...</p>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {verdict && selectedResult && (
          <ResultCard verdict={verdict} address={selectedResult.label} />
        )}
      </main>
    </div>
  );
}
