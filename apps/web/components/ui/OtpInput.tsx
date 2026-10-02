'use client';

import { useRef } from 'react';

/** Поле для 6-значного кода: шесть ячеек, вставка из буфера, автопереход */
export function OtpInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const set = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).replace(/\D/g, '').slice(0, 6);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-callout font-bold">{label}</legend>
      <div className="flex gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`${label}, цифра ${i + 1}`}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoFocus={autoFocus && i === 0}
            maxLength={1}
            value={d}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              if (!v) return set(i, '');
              set(i, v[v.length - 1]!);
              refs.current[Math.min(i + 1, 5)]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
              if (text) {
                e.preventDefault();
                onChange(text);
                refs.current[Math.min(text.length, 5)]?.focus();
              }
            }}
            className="tabular h-14 w-full min-w-0 rounded-md border border-card-border bg-card-solid text-center text-title3 font-extrabold outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        ))}
      </div>
    </fieldset>
  );
}
