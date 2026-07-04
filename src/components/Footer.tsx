'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-20 border-t border-rule bg-paper-soft">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <span className="eyebrow">{t('footer.colophon')}</span>
            <p className="mt-2 font-display text-lg text-ink-text leading-snug">
              {t('footer.lede', { title: t('app.title') })}
            </p>
            <p className="mt-2 text-xs text-secondary leading-relaxed max-w-2xl">
              <span className="font-semibold text-ink-text">{t('footer.notLegalAdvice')}</span>{' '}
              {t('footer.body')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <span className="eyebrow">{t('footer.site')}</span>
              <ul className="mt-2 space-y-1.5">
                <li><Link href="/" className="text-secondary hover:text-brass-deep">{t('nav.home')}</Link></li>
                <li><Link href="/info" className="text-secondary hover:text-brass-deep">{t('nav.info')}</Link></li>
              </ul>
            </div>
            <div>
              <span className="eyebrow">{t('footer.sources')}</span>
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

        <div className="mt-8 pt-6 border-t border-rule flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-muted">
          <LanguageSwitcher />
          <span className="font-mono">© {new Date().getFullYear()} · amirentstabilized.nyc</span>
        </div>
      </div>
    </footer>
  );
}
