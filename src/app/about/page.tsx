import Link from 'next/link';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'About — NYC Rent Stabilization Lookup',
  description:
    'What this tool is, what data it uses, and what it deliberately does not do.',
};

export default function AboutPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <Link href="/" className="text-sm text-accent hover:text-accent-hover">
          &larr; Back
        </Link>

        <h1 className="mt-4 text-4xl font-bold tracking-tight text-primary">
          About this tool
        </h1>
        <p className="mt-3 text-sm text-secondary">
          NYC has roughly one million rent-stabilized apartments, and many
          tenants don&apos;t know they live in one. This tool answers two
          questions: <em>is my building rent-stabilized?</em> and{' '}
          <em>given my lease history, am I being overcharged?</em> If the answer
          to the second is yes, it drafts a complaint you can take to DHCR.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-primary">What it is</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-secondary">
            <li>
              A free tenant-facing lookup against the NYCDB{' '}
              <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
                rentstab_v2
              </code>{' '}
              dataset (a community-maintained scrape of NYC tax-bill PDFs that
              expose stabilized unit counts).
            </li>
            <li>
              An overcharge estimator that walks your lease history forward
              applying the Rent Guidelines Board (RGB) increase that was in
              effect when each renewal started.
            </li>
            <li>
              A draft generator for{' '}
              <a
                href="https://hcr.ny.gov/form-ra-89"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:text-accent-hover"
              >
                DHCR Form RA-89
              </a>{' '}
              (Tenant&apos;s Complaint of Rent Overcharges), pre-filled with
              your numbers.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-primary">
            What it isn&apos;t
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-secondary">
            <li>
              <strong>Not legal advice.</strong> A real overcharge case may
              involve MCI (Major Capital Improvement) and IAI (Individual
              Apartment Improvement) adjustments, vacancy allowances, fraud
              claims, or other facts this tool can&apos;t see.
            </li>
            <li>
              <strong>Not a substitute for your DHCR rent history.</strong> The
              authoritative starting point for any overcharge case is your
              apartment&apos;s registered rent history, requested via{' '}
              <a
                href="https://hcr.ny.gov/records-access"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:text-accent-hover"
              >
                DHCR Records Access (Form REC-1)
              </a>
              .
            </li>
            <li>
              <strong>Not exhaustive.</strong> NYCDB coverage runs through
              roughly 2023; newly-stabilized or de-regulated buildings may
              show stale information. The result page links to the DHCR
              Building Search so you can cross-check.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-primary">How it works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-secondary">
            <li>
              Address autocomplete is powered by{' '}
              <a
                href="https://geosearch.planninglabs.nyc/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:text-accent-hover"
              >
                NYC Planning Labs GeoSearch
              </a>
              , which gives us a normalized address and the building&apos;s
              Borough-Block-Lot (BBL).
            </li>
            <li>
              The BBL is looked up against a local SQLite database seeded from
              NYCDB rentstab_v2. We surface stabilized unit counts and
              whether the building appears on the DHCR list.
            </li>
            <li>
              If you enter a lease history, we apply RGB Apartment Orders
              #1&#x2013;#57 to compute the legal renewal rent and flag any year where
              the actual rent exceeded it.
            </li>
            <li>
              Overcharge totals are summed only over the 6-year statute window
              (HSTPA, 2019). The complaint draft is generated by Anthropic
              Claude and modeled on Form RA-89.
            </li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-primary">Get help</h2>
          <p className="mt-3 text-sm text-secondary">
            If this tool surfaces an overcharge, consider contacting{' '}
            <a
              href="https://www.metcouncilonhousing.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline hover:text-accent-hover"
            >
              Met Council on Housing
            </a>{' '}
            (free tenant counseling), the{' '}
            <a
              href="https://www.lawhelpny.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline hover:text-accent-hover"
            >
              LawHelpNY
            </a>{' '}
            attorney directory, or your local tenant association before filing.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
