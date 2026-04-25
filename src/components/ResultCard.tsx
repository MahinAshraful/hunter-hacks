import type { Verdict } from '@/lib/stabilization';

type Props = {
  verdict: Verdict;
  address: string;
  lat?: number;
  lng?: number;
};

const STATUS_CONFIG = {
  likely_stabilized: {
    containerClass: 'border-green-200 bg-green-50',
    headingClass: 'text-green-800',
    heading: 'This building likely has rent-stabilized units.',
    subtext: 'The following evidence was found in the NYCDB rentstab dataset.',
  },
  not_listed: {
    containerClass: 'border-yellow-200 bg-yellow-50',
    headingClass: 'text-yellow-800',
    heading: 'No stabilization record found for this building.',
    subtext:
      'The building isn’t in the NYCDB rentstab dataset. That doesn’t guarantee it’s unregulated — DHCR records lag by 1–2 years, and some stabilized buildings (e.g. recent 421-a / J-51 properties) may not appear. Cross-check with DHCR before drawing conclusions.',
  },
  unknown: {
    containerClass: 'border-gray-200 bg-gray-50',
    headingClass: 'text-gray-700',
    heading: 'We don’t have data on this BBL.',
    subtext:
      'Your address resolved, but the BBL isn’t in our local copy of the NYCDB rentstab snapshot. The DHCR Building Search below is the next stop.',
  },
} as const;

export default function ResultCard({ verdict, address, lat, lng }: Props) {
  const config = STATUS_CONFIG[verdict.status];
  const mapUrl =
    lat !== undefined && lng !== undefined
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
      : null;

  return (
    <div className={`mt-6 rounded-lg border p-6 ${config.containerClass}`}>
      <h2 className={`text-lg font-semibold ${config.headingClass}`}>{config.heading}</h2>
      <p className="mt-1 text-sm text-gray-500">{address}</p>
      <p className="mt-1 text-sm text-gray-600">{config.subtext}</p>

      {verdict.status !== 'unknown' && (
        <dl className="mt-4 space-y-1 text-sm text-gray-700">
          {verdict.unit_count_latest !== undefined && (
            <div className="flex gap-2">
              <dt className="font-medium">Reported stabilized units:</dt>
              <dd>
                {verdict.unit_count_latest}
                {verdict.unit_count_year ? ` (as of ${verdict.unit_count_year})` : ''}
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="font-medium">On DHCR list:</dt>
            <dd>{verdict.on_dhcr_list_latest ? 'Yes' : 'No'}</dd>
          </div>
          {verdict.source_year_max !== undefined && (
            <div className="flex gap-2">
              <dt className="font-medium">Most recent evidence year:</dt>
              <dd>{verdict.source_year_max}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <a
          href={verdict.dhcr_verify_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
        >
          Verify on DHCR Building Search
        </a>
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
          >
            View on map
          </a>
        )}
        <a
          href="https://hcr.ny.gov/records-access"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
        >
          Request rent history (REC-1)
        </a>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        This tool is for informational purposes only. Data may be out of date (NYCDB rentstab
        coverage through ~2023). Always verify your apartment&apos;s status directly with DHCR by
        requesting your rent history.
      </p>
    </div>
  );
}
