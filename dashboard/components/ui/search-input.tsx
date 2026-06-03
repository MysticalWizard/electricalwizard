'use client';

import { useState, useEffect } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  delay = 300,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Sync local state when the controlled `value` prop changes, adjusting
  // during render rather than in an effect (per React docs).
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, delay);
    return () => clearTimeout(timer);
  }, [local, delay, onChange, value]);

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder={placeholder}
      className="bg-surface border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
    />
  );
}
