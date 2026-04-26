'use client';

import type { Verdict } from '@/lib/stabilization';

type Props = {
  verdict: Verdict;
  address: string;
};

const STATUS_CONFIG = {
  likely_stabilized: {
    accent: 'text-verdigris',
    accentBg: 'bg-verdigris-bg',
    accentBd: 'border-verdigris-bd',
    pillBg: 'bg-verdigris',
    pillText: 'text-bone',
    badge: 'Likely stabilized',
    headline: 'This building likely has rent-stabilized units.',
    sub: 'Evidence found in the NYCDB rentstab dataset and / or the DHCR list.',
  },
  not_listed: {
    accent: 'text-warning',
    accentBg: 'bg-warning-bg',
    accentBd: 'border-warning-bd',
    pillBg: 'bg-warning',
    pillText: 'text-bone',
    badge: 'Not listed',
    headline: 'No stabilization record found for this building.',
    sub: 'DHCR records lag by 1–2 years and some stabilized buildings (recent 421-a / J-51) may not appear. Cross-check with DHCR before concluding.',
  },
  unknown: {
    accent: 'text-warning',
    accentBg: 'bg-warning-bg',
    accentBd: 'border-warning-bd',
    pillBg: 'bg-warning',
    pillText: 'text-bone',
    badge: 'Likely not stabilized',
    headline: 'This building is probably not rent-stabilized.',
    sub: 'We didn’t find your address on the DHCR list or in the NYCDB rent-stabilization dataset. Buildings outside these records are usually condos, co-ops, single/two-family homes, or post-1974 construction — none of which are typically rent-stabilized. To be 100% sure, verify directly with DHCR.',
  },
} as const;

export default function ResultCard({ verdict, address }: Props) {
  const config = STATUS_CONFIG[verdict.status];
  const [primaryAddr, ...rest] = address.split(',');
  const tail = rest.join(',').trim();

  return (
    <section className="paper relative overflow-hidden animate-fade-in-up">
      {/* Top architectural strip */}
      <div className={`absolute inset-x-0 top-0 h-[3px] ${config.pillBg}`} />
      <div className="px-6 sm:px-8 pt-6 pb-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="eyebrow">Verdict · Section II</span>
              <span className="h-px w-8 bg-rule" />
              <span className="text-[11px] text-muted font-mono">BBL {verdict.bbl}</span>
            </div>
            <h2 className="mt-2 font-display text-[28px] sm:text-[32px] leading-[1.05] tracking-tight text-ink-text">
              <span className={`block first-letter:font-display first-letter:text-[42px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:leading-[0.85] first-letter:${config.accent}`}>
                {config.headline}
              </span>
            </h2>
            <p className="mt-2 text-sm text-secondary max-w-xl">{config.sub}</p>
            <p className="mt-3 font-display italic text-sm text-secondary">
              <span className="text-ink-text font-medium not-italic">{primaryAddr}</span>
              {tail && <span className="text-muted">, {tail}</span>}
            </p>
          </div>
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${config.pillBg} ${config.pillText}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {config.badge}
          </span>
        </div>

        {verdict.status !== 'unknown' && (
          <>
            <div className="my-5 rule" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DataPoint
                label="On DHCR list"
                value={verdict.on_dhcr_list_latest ? 'Yes' : 'No'}
                tone={verdict.on_dhcr_list_latest ? 'verdigris' : 'muted'}
              />
              {verdict.source_year_max !== undefined && (
                <DataPoint label="Most recent evidence" value={String(verdict.source_year_max)} />
              )}
            </dl>
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <a
            href={verdict.dhcr_verify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-rule bg-bone px-3 py-2 text-sm font-medium text-ink-text hover:border-brass hover:bg-brass-wash hover:text-brass-deep"
          >
            Verify on DHCR
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 9l6-6M5 3h4v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a
            href="https://hcr.ny.gov/records-access"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-rule bg-bone px-3 py-2 text-sm font-medium text-ink-text hover:border-brass hover:bg-brass-wash hover:text-brass-deep"
          >
            Request rent history (REC-1)
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 9l6-6M5 3h4v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <p className="mt-5 text-[11px] leading-relaxed text-muted">
          Informational only — NYCDB rentstab coverage runs through ~2023. Always verify your apartment’s status directly with DHCR.
        </p>
      </div>
    </section>
  );
}

function DataPoint({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'verdigris' | 'muted';
}) {
  const valueClass =
    tone === 'verdigris' ? 'text-verdigris' : tone === 'muted' ? 'text-muted' : 'text-ink-text';
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 font-display text-[22px] leading-none tabular ${valueClass}`}>{value}</dd>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
