'use client';

import { useState } from 'react';
import type { LeaseEntry, BaseRent } from '@/lib/overcharge';

type LeaseRow = {
  startDate: string;
  endDate: string;
  monthlyRent: string;
  leaseTermMonths: 12 | 24;
};

type Props = {
  isSubmitting: boolean;
  onSubmit: (input: { history: LeaseEntry[]; baseRent?: BaseRent }) => void;
};

const EMPTY_ROW: LeaseRow = {
  startDate: '',
  endDate: '',
  monthlyRent: '',
  leaseTermMonths: 12,
};

function isCompleteRow(row: LeaseRow): boolean {
  return (
    row.startDate.length === 10 &&
    row.endDate.length === 10 &&
    row.monthlyRent.trim() !== '' &&
    Number.parseFloat(row.monthlyRent) > 0
  );
}

export default function RentHistoryForm({ isSubmitting, onSubmit }: Props) {
  const [rows, setRows] = useState<LeaseRow[]>([{ ...EMPTY_ROW }]);
  const [includeBase, setIncludeBase] = useState(false);
  const [baseAmount, setBaseAmount] = useState('');
  const [baseAsOf, setBaseAsOf] = useState('');
  const [baseTerm, setBaseTerm] = useState<12 | 24>(12);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<LeaseRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const completeRows = rows.filter(isCompleteRow);
    if (completeRows.length === 0) {
      setError('Add at least one complete lease (start, end, rent).');
      return;
    }

    for (const r of completeRows) {
      if (r.startDate >= r.endDate) {
        setError(`Lease starting ${r.startDate} must end after it starts.`);
        return;
      }
    }

    const history: LeaseEntry[] = completeRows.map((r) => ({
      startDate: r.startDate,
      endDate: r.endDate,
      monthlyRent: Number.parseFloat(r.monthlyRent),
      leaseTermMonths: r.leaseTermMonths,
    }));

    let baseRent: BaseRent | undefined;
    if (includeBase) {
      const amt = Number.parseFloat(baseAmount);
      if (!Number.isFinite(amt) || amt <= 0 || baseAsOf.length !== 10) {
        setError('Registered base rent needs both an amount and an "as of" date.');
        return;
      }
      baseRent = { amount: amt, asOfDate: baseAsOf, termMonths: baseTerm };
    }

    onSubmit({ history, baseRent });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Check your rent</h3>
        <p className="mt-1 text-sm text-gray-500">
          Enter every lease you&apos;ve signed at this apartment. We&apos;ll compare each renewal to the
          legal RGB increase for that year.
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <span className="col-span-3">Lease start</span>
          <span className="col-span-3">Lease end</span>
          <span className="col-span-3">Monthly rent</span>
          <span className="col-span-2">Term</span>
          <span className="col-span-1" />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              type="date"
              value={row.startDate}
              onChange={(e) => updateRow(i, { startDate: e.target.value })}
              className="col-span-3 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
            <input
              type="date"
              value={row.endDate}
              onChange={(e) => updateRow(i, { endDate: e.target.value })}
              className="col-span-3 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
            <div className="relative col-span-3">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={row.monthlyRent}
                onChange={(e) => updateRow(i, { monthlyRent: e.target.value })}
                placeholder="2000.00"
                className="w-full rounded-md border border-gray-300 px-3 py-2 pl-6 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <select
              value={row.leaseTermMonths}
              onChange={(e) => updateRow(i, { leaseTermMonths: Number(e.target.value) as 12 | 24 })}
              className="col-span-2 rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={12}>1 year</option>
              <option value={24}>2 years</option>
            </select>
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              className="col-span-1 rounded-md border border-gray-200 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Remove lease"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          + Add another lease
        </button>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={includeBase}
            onChange={(e) => setIncludeBase(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium">I have a registered base rent</span> from a DHCR rent
            history (Records Access, Form REC-1). Adding this gives a more reliable estimate.
          </span>
        </label>
        {includeBase && (
          <div className="mt-3 grid grid-cols-12 gap-2">
            <div className="relative col-span-4">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                placeholder="Registered rent"
                className="w-full rounded-md border border-gray-300 px-3 py-2 pl-6 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <input
              type="date"
              value={baseAsOf}
              onChange={(e) => setBaseAsOf(e.target.value)}
              className="col-span-4 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="As of date"
            />
            <select
              value={baseTerm}
              onChange={(e) => setBaseTerm(Number(e.target.value) as 12 | 24)}
              className="col-span-4 rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={12}>1-year base lease</option>
              <option value={24}>2-year base lease</option>
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isSubmitting ? 'Calculating…' : 'Estimate overcharge'}
      </button>
    </form>
  );
}
