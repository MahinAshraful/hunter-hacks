'use client';

// ─────────────────────────────────────────────────────────────────────
// Tiny dependency-free i18n layer.
//
// Why not next-intl/react-i18next: every page in this app is already a
// client component, so a context + typed dictionaries covers the whole
// requirement (runtime switching from anywhere, easy to add languages)
// without new dependencies, routing changes, or middleware.
//
// The locale is persisted to localStorage and applied after mount —
// the static prerender is always English, then hydrates to the saved
// locale. That one-frame swap is the standard trade-off for client-only
// i18n and avoids hydration mismatches.
// ─────────────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en, type MessageKey } from './messages/en';
import { es } from './messages/es';
import { zh } from './messages/zh';
import { bn } from './messages/bn';

export type Locale = 'en' | 'es' | 'zh' | 'bn';

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'zh', label: '中文' },
  { code: 'bn', label: 'বাংলা' },
];

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, es, zh, bn };

const STORAGE_KEY = 'airs:locale';

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a key, replacing {name} placeholders from params. */
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Restore the locale after mount (see header comment for why). A
  // `?lang=xx` URL param wins over the saved preference — it makes links
  // shareable in a specific language — and is then persisted like a
  // manual selection. The swap is deferred one frame so hydration
  // completes against the English prerender first.
  useEffect(() => {
    let wanted: string | null = null;
    try {
      wanted = new URLSearchParams(window.location.search).get('lang');
      if (wanted && wanted in DICTIONARIES) {
        window.localStorage.setItem(STORAGE_KEY, wanted);
      } else {
        wanted = window.localStorage.getItem(STORAGE_KEY);
      }
    } catch { /* storage disabled */ }
    if (wanted && wanted !== 'en' && wanted in DICTIONARIES) {
      const id = requestAnimationFrame(() => setLocaleState(wanted as Locale));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  // Keep <html lang> in sync for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch { /* storage disabled */ }
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => {
      // Fall back to English for any key a locale leaves empty.
      const template = DICTIONARIES[locale][key] || en[key];
      return interpolate(template, params);
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
