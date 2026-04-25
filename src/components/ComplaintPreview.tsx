'use client';

import { useEffect, useRef, useState } from 'react';
import type { Verdict } from '@/lib/stabilization';
import type { Estimate } from '@/lib/overcharge';
import type { FieldMap } from '@/lib/complaint';

type Props = {
  verdict: Verdict;
  estimate: Estimate;
  address: string;
};

type Phase = 'idle' | 'streaming' | 'done' | 'error';

export default function ComplaintPreview({ verdict, estimate, address }: Props) {
  const [tenantName, setTenantName] = useState('');
  const [unit, setUnit] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [fields, setFields] = useState<FieldMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function handleDraft() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase('streaming');
    setText('');
    setFields(null);
    setError(null);
    setCopied(false);

    try {
      const res = await fetch('/api/complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verdict,
          estimate,
          address,
          tenantName: tenantName.trim() || undefined,
          unit: unit.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorBody.error ?? `Request failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;

          let event: { type: string; data?: unknown };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === 'fields') {
            setFields(event.data as FieldMap);
          } else if (event.type === 'text' && typeof event.data === 'string') {
            setText((prev) => prev + (event.data as string));
          } else if (event.type === 'error') {
            throw new Error(typeof event.data === 'string' ? event.data : 'Streaming error');
          }
        }
      }

      setPhase('done');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Complaint draft failed:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong drafting the complaint.');
      setPhase('error');
    }
  }

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function handleDownload() {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhcr-overcharge-complaint-${verdict.bbl}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isStreaming = phase === 'streaming';
  const showText = text.length > 0;

  return (
    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
      <h2 className="text-lg font-semibold text-blue-900">Draft a DHCR overcharge complaint</h2>
      <p className="mt-1 text-sm text-gray-600">
        We&apos;ll generate plain-English complaint text modeled on DHCR Form RA-89, pre-filled with
        the figures above. You can edit, copy, or download it before filing.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            Tenant name (optional)
          </label>
          <input
            type="text"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            placeholder="Jane Tenant"
            disabled={isStreaming}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            Apartment unit (optional)
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="4B"
            disabled={isStreaming}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDraft}
          disabled={isStreaming}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isStreaming ? 'Drafting…' : phase === 'done' ? 'Draft again' : 'Draft my complaint'}
        </button>
        {phase === 'done' && (
          <>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Download .txt
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {showText && (
        <div className="mt-5">
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            ⚠ Draft only — not legal advice. Review and edit every line before filing.
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={isStreaming}
            rows={Math.min(40, Math.max(20, text.split('\n').length + 2))}
            className="mt-2 w-full whitespace-pre-wrap rounded-md border border-gray-300 bg-white px-3 py-3 font-mono text-xs leading-relaxed text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {isStreaming && (
            <p className="mt-1 text-xs text-gray-500">Streaming from Claude…</p>
          )}
        </div>
      )}

      {fields && (
        <details className="mt-4 text-xs text-gray-500">
          <summary className="cursor-pointer font-medium text-gray-600">Extracted fields</summary>
          <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="font-medium">Tenant:</dt>
              <dd>{fields.tenant_name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Unit:</dt>
              <dd>{fields.unit}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Address:</dt>
              <dd>{fields.address}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">BBL:</dt>
              <dd>{fields.bbl}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Legal rent:</dt>
              <dd>${fields.legal_rent_monthly.toFixed(2)}/mo</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Actual rent:</dt>
              <dd>${fields.actual_rent_monthly.toFixed(2)}/mo</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Overcharge:</dt>
              <dd>${fields.overcharge_monthly.toFixed(2)}/mo</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">6-year total:</dt>
              <dd>${fields.overcharge_total_within_limit.toFixed(2)}</dd>
            </div>
          </dl>
        </details>
      )}

      <p className="mt-4 text-xs text-gray-500">
        File your completed complaint with the DHCR Office of Rent Administration. Get the
        official{' '}
        <a
          href="https://hcr.ny.gov/form-ra-89"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          Form RA-89 (and RA-89.1)
        </a>
        , or file online via{' '}
        <a
          href="https://rent.hcr.ny.gov/RentConnect/Tenant/RentOverchargeOverview"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          DHCR Rent Connect
        </a>
        .
      </p>
    </div>
  );
}
