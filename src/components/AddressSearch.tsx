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
        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={activeIndex >= 0 ? `option-${activeIndex}` : undefined}
        autoComplete="off"
      />
      {isLoading && (
        <span className="absolute right-3 top-3 text-xs text-gray-400">Searching...</span>
      )}
      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {results.map((r, i) => (
            <li
              key={r.bbl}
              id={`option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(r)}
              className={`cursor-pointer px-4 py-2 text-sm ${
                i === activeIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
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
