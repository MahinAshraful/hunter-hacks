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
  'w-full rounded-[10px] border border-rule bg-bone px-3 py-2.5 text-sm text-ink-text shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] placeholder:text-muted/70 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/25 disabled:bg-paper-soft';

export default function ComplaintPreview({ verdict, estimate, address }: Props) {
  const [tenantName, setTenantName] = useState('');
  const [unit, setUnit] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [fields, setFields] = useState<FieldMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (textareaRef.current && phase === 'streaming') {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [text, phase]);

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
    <section className="paper relative overflow-hidden animate-fade-in-up">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-brass" />
      <div className="px-6 sm:px-8 pt-6 pb-7">
        <span className="eyebrow">Section IV · Draft</span>
        <h2 className="mt-1.5 font-display text-[28px] sm:text-[32px] leading-[1.05] tracking-tight text-ink-text">
          Draft a DHCR overcharge complaint.
        </h2>
        <p className="mt-2 text-sm text-secondary max-w-xl">
          Plain-English complaint text modeled on DHCR Form RA-89 — pre-filled with your figures.
          Edit, copy, or download before filing.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="eyebrow block">Tenant name <span className="text-muted normal-case tracking-normal text-[11px] font-normal">(optional)</span></label>
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Jane Tenant"
              disabled={isStreaming}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label className="eyebrow block">Apartment unit <span className="text-muted normal-case tracking-normal text-[11px] font-normal">(optional)</span></label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="4B"
              disabled={isStreaming}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDraft}
            disabled={isStreaming}
            className="btn-brass px-5 py-2.5 text-sm flex items-center gap-2 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Drafting…
              </>
            ) : phase === 'done' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8.5l3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Draft again
              </>
            ) : (
              <>
                Draft my complaint
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h8m0 0L7 3m4 4L7 11" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
          {phase === 'done' && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="btn-ghost px-3 py-2 text-sm flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7l3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="4" y="4" width="8" height="8" rx="1.5" />
                      <path d="M2 9V3a1 1 0 0 1 1-1h6" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="btn-ghost px-3 py-2 text-sm flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 2v8m0 0L4 7m3 3l3-3M2 12h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download .txt
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-[10px] border border-rust-bd bg-rust-bg px-4 py-3">
            <p className="text-sm text-rust">{error}</p>
          </div>
        )}

        {showText && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="eyebrow">Draft · DHCR RA-89</span>
              <span className="h-px flex-1 bg-rule" />
              {isStreaming ? (
                <span className="flex items-center gap-1.5 text-[11px] text-brass-deep font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-brass animate-ping opacity-75" />
                    <span className="relative inline-flex rounded-full bg-brass h-2 w-2" />
                  </span>
                  Streaming from Claude
                </span>
              ) : (
                <span className="text-[10px] text-muted">{text.length} characters</span>
              )}
            </div>

            <div className="relative rounded-[12px] border border-rule-strong bg-[linear-gradient(to_bottom,_#fbf6ea,_#f6efe2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_8px_-4px_rgba(20,14,6,0.1)] p-1">
              <div className="rounded-[8px] bg-bone border border-rule/60 overflow-hidden">
                <div className="px-4 py-2 border-b border-rule/70 bg-paper-soft flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rust-bd" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning-bd" />
                    <span className="h-2.5 w-2.5 rounded-full bg-verdigris-bd" />
                  </div>
                  <span className="font-mono text-[10px] text-muted">RA-89-{verdict.bbl}.txt</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  readOnly={isStreaming}
                  rows={Math.min(28, Math.max(18, text.split('\n').length + 2))}
                  className="block w-full bg-transparent px-5 py-4 font-mono text-[12.5px] leading-[1.65] text-ink-text focus:outline-none resize-none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="mt-2 rounded-[10px] border border-warning-bd bg-warning-bg px-3 py-2">
              <p className="text-[11px] text-warning leading-relaxed">
                <span className="font-semibold">Draft only — not legal advice.</span> Review and edit every line before filing.
              </p>
            </div>
          </div>
        )}

        {fields && (
          <details className="mt-4 group">
            <summary className="cursor-pointer flex items-center gap-2">
              <span className="eyebrow">Extracted fields</span>
              <span className="h-px flex-1 bg-rule" />
              <svg className="h-3 w-3 text-muted transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <Field k="Tenant" v={fields.tenant_name} />
              <Field k="Unit" v={fields.unit} />
              <Field k="Address" v={fields.address} />
              <Field k="BBL" v={fields.bbl} mono />
              <Field k="Legal rent" v={`$${fields.legal_rent_monthly.toFixed(2)}/mo`} mono />
              <Field k="Actual rent" v={`$${fields.actual_rent_monthly.toFixed(2)}/mo`} mono />
              <Field k="Overcharge" v={`$${fields.overcharge_monthly.toFixed(2)}/mo`} mono />
              <Field k="6-yr total" v={`$${fields.overcharge_total_within_limit.toFixed(2)}`} mono />
            </dl>
          </details>
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-muted">
          File with the DHCR Office of Rent Administration. Get the official{' '}
          <a
            href="https://hcr.ny.gov/form-ra-89"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-brass/40 underline-offset-2 hover:text-brass-deep hover:decoration-brass"
          >
            Form RA-89
          </a>
          , or file online via{' '}
          <a
            href="https://rent.hcr.ny.gov/RentConnect/Tenant/RentOverchargeOverview"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-brass/40 underline-offset-2 hover:text-brass-deep hover:decoration-brass"
          >
            DHCR Rent Connect
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function Field({ k, v, mono }: { k: string; v: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-rule/60 py-1.5">
      <dt className="text-secondary">{k}</dt>
      <dd className={`text-ink-text ${mono ? 'font-mono' : ''}`}>{v}</dd>
    </div>
  );
}
