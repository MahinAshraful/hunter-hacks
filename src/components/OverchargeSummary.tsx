import type { Estimate } from '@/lib/overcharge';

type Props = {
  estimate: Estimate;
};

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtCents = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const fmtPct = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)}%`);

export default function OverchargeSummary({ estimate }: Props) {
  const hasOvercharge = estimate.overcharge_total_within_limit > 0;
  const containerClass = hasOvercharge
    ? 'border-red-200 bg-red-50'
    : 'border-emerald-200 bg-emerald-50';
  const headingClass = hasOvercharge ? 'text-red-800' : 'text-emerald-800';
  const headline = hasOvercharge
    ? `You may have been overcharged ${fmt(estimate.overcharge_total_within_limit)} in the last 6 years.`
    : 'No overcharge detected in the last 6 years.';

  return (
    <div className={`mt-6 rounded-lg border p-6 ${containerClass}`}>
      <h2 className={`text-lg font-semibold ${headingClass}`}>{headline}</h2>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Your current rent</dt>
          <dd className="mt-1 text-xl font-semibold text-gray-900">
            {fmtCents(estimate.actual_rent_monthly)}/mo
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Estimated legal rent</dt>
          <dd className="mt-1 text-xl font-semibold text-gray-900">
            {fmtCents(estimate.legal_rent_monthly)}/mo
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Monthly overcharge</dt>
          <dd className={`mt-1 text-xl font-semibold ${hasOvercharge ? 'text-red-700' : 'text-gray-900'}`}>
            {fmtCents(estimate.overcharge_monthly)}/mo
          </dd>
        </div>
      </dl>

      {estimate.years_analyzed.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Lease start</th>
                <th className="py-2 pr-3">Term</th>
                <th className="py-2 pr-3 text-right">Allowed %</th>
                <th className="py-2 pr-3 text-right">Actual %</th>
                <th className="py-2 pr-3 text-right">Legal rent</th>
                <th className="py-2 pr-3 text-right">Actual rent</th>
                <th className="py-2 pr-3 text-right">Overcharge / mo</th>
                <th className="py-2 text-right">Within 6-yr window</th>
              </tr>
            </thead>
            <tbody>
              {estimate.years_analyzed.map((y) => (
                <tr key={y.lease_start} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-700">{y.lease_start}</td>
                  <td className="py-2 pr-3 text-gray-700">
                    {y.term_months === 24 ? '2-yr' : '1-yr'}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-700">{fmtPct(y.allowed_pct)}</td>
                  <td className="py-2 pr-3 text-right text-gray-700">{fmtPct(y.actual_pct)}</td>
                  <td className="py-2 pr-3 text-right text-gray-700">{fmtCents(y.legal_monthly)}</td>
                  <td className="py-2 pr-3 text-right text-gray-700">{fmtCents(y.actual_monthly)}</td>
                  <td
                    className={`py-2 pr-3 text-right ${
                      y.overcharge_monthly > 0 ? 'font-semibold text-red-700' : 'text-gray-400'
                    }`}
                  >
                    {y.overcharge_monthly > 0 ? fmtCents(y.overcharge_monthly) : '—'}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      y.overcharge_within_limit > 0 ? 'font-semibold text-red-700' : 'text-gray-400'
                    }`}
                  >
                    {y.overcharge_within_limit > 0 ? fmtCents(y.overcharge_within_limit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estimate.caveats.length > 0 && (
        <details className="mt-4 text-xs text-gray-500">
          <summary className="cursor-pointer font-medium text-gray-600">
            Caveats and assumptions
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {estimate.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Estimate only — not legal advice. The DHCR is the authoritative source. To anchor on a
        registered base rent, request your apartment rent history from DHCR{' '}
        <a
          href="https://hcr.ny.gov/records-access"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600"
        >
          Records Access (Form REC-1)
        </a>
        .
      </p>
    </div>
  );
}
