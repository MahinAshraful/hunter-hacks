import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface-muted">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 text-xs text-secondary">
        <p className="font-medium text-primary">
          Not legal advice. Estimates only.
        </p>
        <p className="mt-2">
          This tool surfaces public DHCR / NYCDB rent-stabilization data and
          calculates an indicative overcharge using NYC Rent Guidelines Board
          increases. It does not model MCI/IAI adjustments, vacancy
          allowances, or any case-specific facts. Always verify directly with
          DHCR and consider speaking with a tenant attorney before filing.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/" className="hover:text-accent">
            Home
          </Link>
          <Link href="/about" className="hover:text-accent">
            About
          </Link>
          <a
            href="https://hcr.ny.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent"
          >
            DHCR (hcr.ny.gov)
          </a>
          <a
            href="https://www.nycdb.info/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent"
          >
            NYCDB
          </a>
        </div>
      </div>
    </footer>
  );
}
