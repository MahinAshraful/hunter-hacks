'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Verdict } from '@/lib/stabilization';

const MapThumbnail = dynamic(() => import('@/components/MapThumbnail'), { ssr: false });
const MapModal = dynamic(() => import('@/components/MapModal'), { ssr: false });

type Props = {
  verdict: Verdict;
  address: string;
  lat?: number;
  lng?: number;
};

const STATUS_CONFIG = {
  likely_stabilized: {
    stripColor: 'bg-success',
    badgeClass: 'bg-success-bg text-success',
    badgeLabel: 'Likely stabilized',
    heading: 'This building likely has rent-stabilized units.',
    subtext: 'The following evidence was found in the NYCDB rentstab dataset.',
  },
  not_listed: {
    stripColor: 'bg-warning',
    badgeClass: 'bg-warning-bg text-warning',
    badgeLabel: 'Not listed',
    heading: 'No stabilization record found for this building.',
    subtext:
      'The building isn’t in the NYCDB rentstab dataset. That doesn’t guarantee it’s unregulated — DHCR records lag by 1–2 years, and some stabilized buildings (e.g. recent 421-a / J-51 properties) may not appear. Cross-check with DHCR before drawing conclusions.',
  },
  unknown: {
    stripColor: 'bg-muted',
    badgeClass: 'bg-neutral-bg text-secondary',
    badgeLabel: 'Unknown',
    heading: 'We don’t have data on this BBL.',
    subtext:
      'Your address resolved, but the BBL isn’t in our local copy of the NYCDB rentstab snapshot. The DHCR Building Search below is the next stop.',
  },
} as const;

const linkClass =
  'inline-flex items-center rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-accent-surface hover:text-accent';

export default function ResultCard({ verdict, address, lat, lng }: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const config = STATUS_CONFIG[verdict.status];
  const hasCoords = lat !== undefined && lng !== undefined;

  return (
    <>
      <div className="mt-8 rounded-xl border border-border bg-surface shadow-sm overflow-hidden animate-fade-in-up">
        <div className={`h-1.5 ${config.stripColor}`} />
        <div className="p-6 md:flex md:gap-6">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${config.badgeClass}`}>
              {config.badgeLabel}
            </span>
            <h2 className="mt-3 text-lg font-semibold text-primary">{config.heading}</h2>
            <p className="mt-1 text-sm text-secondary">{address}</p>
            <p className="mt-1 text-sm text-secondary">{config.subtext}</p>

            {verdict.status !== 'unknown' && (
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                {verdict.unit_count_latest !== undefined && (
                  <>
                    <dt className="font-medium text-primary">Reported stabilized units</dt>
                    <dd className="text-secondary">
                      {verdict.unit_count_latest}
                      {verdict.unit_count_year ? ` (as of ${verdict.unit_count_year})` : ''}
                    </dd>
                  </>
                )}
                <dt className="font-medium text-primary">On DHCR list</dt>
                <dd className="text-secondary">{verdict.on_dhcr_list_latest ? 'Yes' : 'No'}</dd>
                {verdict.source_year_max !== undefined && (
                  <>
                    <dt className="font-medium text-primary">Most recent evidence year</dt>
                    <dd className="text-secondary">{verdict.source_year_max}</dd>
                  </>
                )}
              </dl>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={verdict.dhcr_verify_url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Verify on DHCR
              </a>
              <a
                href="https://hcr.ny.gov/records-access"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Request rent history (REC-1)
              </a>
            </div>

            <p className="mt-4 text-xs text-muted">
              This tool is for informational purposes only. Data may be out of date (NYCDB rentstab
              coverage through ~2023). Always verify your apartment&apos;s status directly with DHCR by
              requesting your rent history.
            </p>
          </div>

          {hasCoords && (
            <div className="mt-5 md:mt-0 md:w-72 md:flex-shrink-0">
              <MapThumbnail
                lat={lat!}
                lng={lng!}
                address={address}
                onClick={() => setMapOpen(true)}
              />
            </div>
          )}
        </div>
      </div>

      {hasCoords && (
        <MapModal
          lat={lat!}
          lng={lng!}
          address={address}
          isOpen={mapOpen}
          onClose={() => setMapOpen(false)}
        />
      )}
    </>
  );
}
