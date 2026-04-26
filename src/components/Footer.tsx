import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-rule bg-paper-soft">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <span className="eyebrow">Colophon</span>
            <p className="mt-2 font-display text-lg text-ink-text leading-snug">
              <span className="italic">Am I Rent Stabilized?</span> is a free tenant lookup for the roughly one&nbsp;million rent-stabilized apartments in New York City.
            </p>
            <p className="mt-2 text-xs text-secondary leading-relaxed max-w-2xl">
              Surfaces public DHCR / NYCDB rent-stabilization data and computes an indicative
              overcharge using NYC Rent Guidelines Board increases. It does not model MCI/IAI
              adjustments, vacancy allowances, or any case-specific facts. <span className="font-semibold text-ink-text">Not legal advice.</span>{' '}
              Always verify directly with DHCR and consider speaking with a tenant attorney before filing.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <span className="eyebrow">Site</span>
              <ul className="mt-2 space-y-1.5">
                <li><Link href="/" className="text-secondary hover:text-brass-deep">Home</Link></li>
                <li><Link href="/info" className="text-secondary hover:text-brass-deep">Info</Link></li>
              </ul>
            </div>
            <div>
              <span className="eyebrow">Sources</span>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <a
                    href="https://hcr.ny.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-brass-deep inline-flex items-center gap-1"
                  >
                    DHCR <span aria-hidden>↗</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.nycdb.info/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-brass-deep inline-flex items-center gap-1"
                  >
                    NYCDB <span aria-hidden>↗</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://rentguidelinesboard.cityofnewyork.us/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-brass-deep inline-flex items-center gap-1"
                  >
                    RGB <span aria-hidden>↗</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-rule flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-muted">
          <span className="font-display italic">An aerial view of every NYC building.</span>
          <span className="font-mono">© {new Date().getFullYear()} · amirentstabilized.nyc</span>
        </div>
      </div>
    </footer>
  );
}
