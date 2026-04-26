'use client';

import { useState, useEffect, useRef } from 'react';
import { autocomplete, type GeoResult } from '@/lib/geosearch';

type Props = {
  onSelect: (result: GeoResult) => void;
  disabled?: boolean;
  variant?: 'default' | 'hero';
  initialValue?: string;
};

export default function AddressSearch({ onSelect, disabled, variant = 'default', initialValue }: Props) {
  const [inputValue, setInputValue] = useState(initialValue ?? '');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = inputValue.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await autocomplete(trimmed);
      setResults(data);
      setIsOpen(data.length > 0);
      setIsLoading(false);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function handleSelect(result: GeoResult) {
    setInputValue(result.label);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(result);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) handleSelect(results[activeIndex]);
      else if (results[0]) handleSelect(results[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const isHero = variant === 'hero';

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative group">
        {/* Decorative outer brass frame on focus */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-[3px] rounded-[16px] transition-opacity duration-300 ${
            isFocused
              ? 'opacity-100 bg-gradient-to-br from-brass-glow/60 via-brass/30 to-brass-deep/40 blur-[2px]'
              : 'opacity-0'
          }`}
        />
        <div className={`relative flex items-center rounded-[14px] border ${
          isHero ? 'bg-bone' : 'bg-bone'
        } ${
          isFocused ? 'border-brass shadow-[0_8px_24px_-12px_rgba(176,122,26,0.45)]' : 'border-rule-strong shadow-[0_2px_0_rgba(255,255,255,0.6)_inset,0_8px_22px_-14px_rgba(20,14,6,0.25)]'
        }`}>
          <span className="pl-5 pr-3 py-3.5 flex items-center gap-2 border-r border-rule">
            <svg
              className={`h-5 w-5 ${isFocused ? 'text-brass' : 'text-secondary'} transition-colors`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            <span className="eyebrow hidden sm:inline">Address</span>
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isHero ? 'e.g. 350 West 50th Street' : 'Enter a NYC address…'}
            disabled={disabled}
            className={`flex-1 bg-transparent px-4 ${
              isHero ? 'py-4 text-lg font-display' : 'py-3 text-base'
            } text-ink-text placeholder:text-muted/80 focus:outline-none disabled:opacity-50`}
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-activedescendant={activeIndex >= 0 ? `option-${activeIndex}` : undefined}
            autoComplete="off"
          />
          <div className="flex items-center pr-3 gap-2">
            {isLoading ? (
              <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-rule px-1.5 py-0.5 text-[10px] font-mono text-muted">
                <span>↵</span>
              </kbd>
            )}
          </div>
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-[12px] border border-rule-strong bg-bone py-1 shadow-[0_24px_60px_-20px_rgba(20,14,6,0.35)] animate-fade-in-up"
        >
          {results.map((r, i) => {
            const active = i === activeIndex;
            const [primary, ...rest] = r.label.split(',');
            const secondary = rest.join(',').trim();
            return (
              <li
                key={`${r.bbl}-${i}`}
                id={`option-${i}`}
                role="option"
                aria-selected={active}
                onMouseDown={() => handleSelect(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-start gap-3 cursor-pointer px-4 py-2.5 ${
                  active ? 'bg-brass-wash' : 'hover:bg-paper-soft'
                }`}
              >
                <span className={`mt-1 inline-block h-2 w-2 rounded-full ${
                  active ? 'bg-brass' : 'bg-rule-strong'
                }`} />
                <span className="flex-1 min-w-0">
                  <span className={`block truncate text-sm font-medium ${
                    active ? 'text-brass-deep' : 'text-ink-text'
                  }`}>
                    {primary}
                  </span>
                  {secondary && (
                    <span className="block truncate text-xs text-muted">{secondary}</span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-muted whitespace-nowrap mt-1">
                  BBL {r.bbl.slice(0, 4)}…
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
