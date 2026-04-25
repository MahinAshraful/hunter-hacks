'use client';

import { useState } from 'react';
import AddressSearch from '@/components/AddressSearch';
import DemoAddresses from '@/components/DemoAddresses';
import ResultCard from '@/components/ResultCard';
import RentHistoryForm from '@/components/RentHistoryForm';
import OverchargeSummary from '@/components/OverchargeSummary';
import ComplaintPreview from '@/components/ComplaintPreview';
import Footer from '@/components/Footer';
import type { GeoResult } from '@/lib/geosearch';
import type { Verdict } from '@/lib/stabilization';
import type { Estimate, LeaseEntry, BaseRent } from '@/lib/overcharge';

type LookupResponse = Verdict & { lookupId?: number };

export default function Home() {
  const [selectedResult, setSelectedResult] = useState<GeoResult | null>(null);
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  async function handleSelect(result: GeoResult) {
    setSelectedResult(result);
    setLookup(null);
    setLookupError(null);
    setEstimate(null);
    setEstimateError(null);
    setIsLooking(true);

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbl: result.bbl, address: result.label }),
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorBody.error ?? `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as LookupResponse;
      setLookup(data);
    } catch (err) {
      console.error('Lookup failed:', err);
      setLookupError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLooking(false);
    }
  }

  async function handleEstimate(input: { history: LeaseEntry[]; baseRent?: BaseRent }) {
    if (!lookup) return;
    setEstimate(null);
    setEstimateError(null);
    setIsEstimating(true);

    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, bbl: lookup.bbl, lookupId: lookup.lookupId }),
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorBody.error ?? `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as Estimate;
      setEstimate(data);
    } catch (err) {
      console.error('Estimate failed:', err);
      setEstimateError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsEstimating(false);
    }
  }

  const showForm = lookup?.status === 'likely_stabilized';

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          NYC Rent Stabilization Lookup
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Search any NYC address. If the building is rent-stabilized, enter your lease history to
          estimate whether you&apos;ve been overcharged.
        </p>

        <div className="mt-8">
          <AddressSearch onSelect={handleSelect} disabled={isLooking} />
          <DemoAddresses onSelect={handleSelect} disabled={isLooking} />
        </div>

        {isLooking && (
          <p className="mt-4 text-sm text-gray-400">Looking up stabilization status…</p>
        )}

        {lookupError && <p className="mt-4 text-sm text-red-600">{lookupError}</p>}

        {lookup && selectedResult && (
          <ResultCard
            verdict={lookup}
            address={selectedResult.label}
            lat={selectedResult.lat}
            lng={selectedResult.lng}
          />
        )}

        {showForm && (
          <RentHistoryForm isSubmitting={isEstimating} onSubmit={handleEstimate} />
        )}

        {isEstimating && (
          <p className="mt-4 text-sm text-gray-400">Crunching RGB increases…</p>
        )}

        {estimateError && <p className="mt-4 text-sm text-red-600">{estimateError}</p>}

        {estimate && <OverchargeSummary estimate={estimate} />}

        {estimate && lookup?.status === 'likely_stabilized' && selectedResult && (
          <ComplaintPreview
            verdict={lookup}
            estimate={estimate}
            address={selectedResult.label}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
