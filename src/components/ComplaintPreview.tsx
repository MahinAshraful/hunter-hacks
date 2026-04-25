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

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:bg-surface-muted';

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
    <div className="mt-8 rounded-xl border border-border bg-surface shadow-sm overflow-hidden animate-fade-in-up">
      <div className="h-1.5 bg-accent" />
      <div className="p-6">
        <h2 className="text-lg font-semibold text-primary">Draft a DHCR overcharge complaint</h2>
        <p className="mt-1 text-sm text-secondary">
          We&apos;ll generate plain-English complaint text modeled on DHCR Form RA-89, pre-filled with
          the figures above. You can edit, copy, or download it before filing.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-secondary">
              Tenant name (optional)
            </label>
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Jane Tenant"
              disabled={isStreaming}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-secondary">
              Apartment unit (optional)
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="4B"
              disabled={isStreaming}
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDraft}
            disabled={isStreaming}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 disabled:opacity-50"
          >
            {isStreaming ? 'Drafting…' : phase === 'done' ? 'Draft again' : 'Draft my complaint'}
          </button>
          {phase === 'done' && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-primary shadow-sm hover:bg-surface-muted"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-primary shadow-sm hover:bg-surface-muted"
              >
                Download .txt
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-danger-border bg-danger-bg p-3">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {showText && (
          <div className="mt-5">
            <div className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs font-medium text-warning">
              Draft only — not legal advice. Review and edit every line before filing.
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              readOnly={isStreaming}
              rows={Math.min(40, Math.max(20, text.split('\n').length + 2))}
              className="mt-2 w-full whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-3 font-mono text-xs leading-relaxed text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            {isStreaming && (
              <div className="mt-1 flex items-center gap-2 text-xs text-secondary">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Streaming from Claude…
              </div>
            )}
          </div>
        )}

        {fields && (
          <details className="mt-4 text-xs text-secondary">
            <summary className="cursor-pointer font-medium text-primary">Extracted fields</summary>
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

        <p className="mt-4 text-xs text-muted">
          File your completed complaint with the DHCR Office of Rent Administration. Get the
          official{' '}
          <a
            href="https://hcr.ny.gov/form-ra-89"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            Form RA-89 (and RA-89.1)
          </a>
          , or file online via{' '}
          <a
            href="https://rent.hcr.ny.gov/RentConnect/Tenant/RentOverchargeOverview"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            DHCR Rent Connect
          </a>
          .
        </p>
      </div>
    </div>
  );
}
