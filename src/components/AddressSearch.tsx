'use client';

import { useState, useEffect, useRef } from 'react';
import { autocomplete, type GeoResult } from '@/lib/geosearch';

type Props = {
  onSelect: (result: GeoResult) => void;
  disabled?: boolean;
};

export default function AddressSearch({ onSelect, disabled }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

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
    }, 250);

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
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter a NYC address..."
          disabled={disabled}
          className="w-full rounded-xl border border-border bg-surface pl-12 pr-5 py-3 text-base text-primary placeholder-muted shadow-sm transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 focus:shadow-md disabled:opacity-50"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={activeIndex >= 0 ? `option-${activeIndex}` : undefined}
          autoComplete="off"
        />
        {isLoading && (
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {results.map((r, i) => (
            <li
              key={r.bbl}
              id={`option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(r)}
              className={`cursor-pointer px-4 py-2.5 text-sm ${
                i === activeIndex ? 'bg-accent-surface text-accent' : 'text-primary hover:bg-surface-muted'
              }`}
            >
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
