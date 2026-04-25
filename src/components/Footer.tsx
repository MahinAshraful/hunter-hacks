import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 text-xs text-gray-500">
        <p className="font-medium text-gray-700">
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
          <Link href="/" className="hover:text-gray-700">
            Home
          </Link>
          <Link href="/about" className="hover:text-gray-700">
            About
          </Link>
          <a
            href="https://hcr.ny.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700"
          >
            DHCR (hcr.ny.gov)
          </a>
          <a
            href="https://www.nycdb.info/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700"
          >
            NYCDB
          </a>
        </div>
      </div>
    </footer>
  );
}
