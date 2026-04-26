import Link from 'next/link';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'About — Ledger NYC',
  description:
    'What this tool is, what data it uses, and what it deliberately does not do.',
};

export default function AboutPage() {
  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-md bg-paper/80 border-b border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-ink text-brass-glow font-display font-bold text-sm">L</span>
            <span className="font-display text-[19px] font-semibold tracking-tight text-ink-text group-hover:text-brass-deep">Ledger</span>
            <span className="hidden sm:inline-block ml-1 text-[10px] tracking-[0.18em] uppercase text-muted font-semibold">NYC</span>
          </Link>
          <Link href="/" className="text-sm text-secondary hover:text-brass-deep">
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 sm:px-8 lg:px-10 py-16">
        <span className="eyebrow flex items-center gap-2">
          <span className="h-px w-6 bg-brass" /> Vol. I · About
        </span>
        <h1 className="mt-3 font-display text-[44px] sm:text-[54px] leading-[0.96] tracking-[-0.018em] text-ink-text">
          A tenant-first lookup for the <span className="italic text-brass-deep">million</span> apartments NYC keeps quiet.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-secondary">
          NYC has roughly one million rent-stabilized apartments, and many tenants don&apos;t know they
          live in one. Ledger answers two questions: <em>is my building rent-stabilized?</em> and{' '}
          <em>given my lease history, am I being overcharged?</em> If the answer to the second is
          yes, it drafts a complaint you can take to DHCR.
        </p>

        <div className="my-10 rule" />

        <Section title="What it is" numeral="I">
          <Bullet>
            A free tenant-facing lookup against the NYCDB{' '}
            <code className="rounded bg-paper-soft border border-rule/60 px-1 py-0.5 text-[12px] font-mono text-ink-text">rentstab_v2</code>{' '}
            dataset — a community-maintained scrape of NYC tax-bill PDFs that expose stabilized unit counts.
          </Bullet>
          <Bullet>
            An overcharge estimator that walks your lease history forward applying the Rent Guidelines
            Board (RGB) increase that was in effect when each renewal started.
          </Bullet>
          <Bullet>
            A draft generator for{' '}
            <ExtA href="https://hcr.ny.gov/form-ra-89">DHCR Form RA-89</ExtA>{' '}
            (Tenant&apos;s Complaint of Rent Overcharges), pre-filled with your numbers.
          </Bullet>
        </Section>

        <Section title="What it isn’t" numeral="II">
          <Bullet>
            <strong className="text-ink-text">Not legal advice.</strong> A real overcharge case may involve MCI (Major Capital Improvement) and
            IAI (Individual Apartment Improvement) adjustments, vacancy allowances, fraud claims, or
            other facts this tool can&apos;t see.
          </Bullet>
          <Bullet>
            <strong className="text-ink-text">Not a substitute for your DHCR rent history.</strong> The authoritative starting point for any
            overcharge case is your apartment&apos;s registered rent history, requested via{' '}
            <ExtA href="https://hcr.ny.gov/records-access">DHCR Records Access (Form REC-1)</ExtA>.
          </Bullet>
          <Bullet>
            <strong className="text-ink-text">Not exhaustive.</strong> NYCDB coverage runs through roughly 2023; newly-stabilized or
            de-regulated buildings may show stale information. The result page links to the DHCR
            Building Search so you can cross-check.
          </Bullet>
        </Section>

        <Section title="How it works" numeral="III">
          <Numbered n="1">
            Address autocomplete is powered by{' '}
            <ExtA href="https://geosearch.planninglabs.nyc/">NYC Planning Labs GeoSearch</ExtA>,
            which gives us a normalized address and the building&apos;s Borough-Block-Lot (BBL).
          </Numbered>
          <Numbered n="2">
            The BBL is looked up against a local SQLite database seeded from NYCDB rentstab_v2. We
            surface stabilized unit counts and whether the building appears on the DHCR list.
          </Numbered>
          <Numbered n="3">
            If you enter a lease history, we apply RGB Apartment Orders #1–#57 to compute the legal
            renewal rent and flag any year where the actual rent exceeded it.
          </Numbered>
          <Numbered n="4">
            Overcharge totals are summed only over the 6-year statute window (HSTPA, 2019). The
            complaint draft is generated by Anthropic Claude and modeled on Form RA-89.
          </Numbered>
        </Section>

        <Section title="Get help" numeral="IV">
          <p className="text-sm text-secondary leading-relaxed">
            If this tool surfaces an overcharge, consider contacting{' '}
            <ExtA href="https://www.metcouncilonhousing.org/">Met Council on Housing</ExtA>{' '}
            (free tenant counseling), the{' '}
            <ExtA href="https://www.lawhelpny.org/">LawHelpNY</ExtA>{' '}
            attorney directory, or your local tenant association before filing.
          </p>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, numeral, children }: { title: string; numeral: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[28px] text-brass-deep leading-none">§ {numeral}</span>
        <h2 className="font-display text-[26px] tracking-tight text-ink-text">{title}</h2>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-3 text-sm text-secondary leading-relaxed">
      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brass" />
      <span>{children}</span>
    </p>
  );
}

function Numbered({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex gap-3 text-sm text-secondary leading-relaxed">
      <span className="font-mono text-xs font-semibold text-brass-deep mt-0.5 flex-shrink-0">{n}.</span>
      <span>{children}</span>
    </p>
  );
}

function ExtA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ink-text underline decoration-brass/40 underline-offset-2 hover:text-brass-deep hover:decoration-brass"
    >
      {children}
    </a>
  );
}
