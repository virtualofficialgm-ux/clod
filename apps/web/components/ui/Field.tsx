'use client';

import clsx from 'clsx';
import { forwardRef, useId } from 'react';
import { t, type TranslationKey } from '@parri/shared';

/** Поле в стиле Cal AI: серая заливка без рамки, при фокусе — «чернильная» обводка */
const inputClass =
  'w-full rounded-md border-2 border-transparent bg-fill px-4 text-body font-medium text-text placeholder:text-text-3 outline-none transition focus:border-ink focus:bg-card-solid disabled:opacity-60';

interface FieldShellProps {
  label: string;
  error?: string | null;
  hint?: string;
  counter?: { value: number; max: number };
  id: string;
  children: React.ReactNode;
}

/** Ошибка — ключ локализации (errors.*) или готовый текст */
export function errorText(error?: string | null): string | null {
  if (!error) return null;
  // t() возвращает сам ключ, если перевода нет — тогда показываем текст как есть
  return t(error as TranslationKey);
}

function FieldShell({ label, error, hint, counter, id, children }: FieldShellProps) {
  const err = errorText(error);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-callout font-bold text-text">
          {label}
        </label>
        {counter && (
          <span className={clsx('tabular text-caption', counter.value > counter.max ? 'text-danger' : 'text-text-2')}>
            {t('common.chars', { n: counter.value, max: counter.max })}
          </span>
        )}
      </div>
      {children}
      {err ? (
        <p id={`${id}-error`} role="alert" className="text-callout font-semibold text-danger">
          {err}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-callout text-text-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
  counterMax?: number;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, counterMax, className, id: idProp, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const value = typeof rest.value === 'string' ? rest.value : '';
  return (
    <FieldShell label={label} error={error} hint={hint} id={id} counter={counterMax ? { value: value.length, max: counterMax } : undefined}>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={clsx(inputClass, 'h-14', className)}
        {...rest}
      />
    </FieldShell>
  );
});

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | null;
  hint?: string;
  counterMax?: number;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, counterMax, className, id: idProp, rows = 4, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const value = typeof rest.value === 'string' ? rest.value : '';
  return (
    <FieldShell label={label} error={error} hint={hint} id={id} counter={counterMax ? { value: value.length, max: counterMax } : undefined}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={clsx(inputClass, 'resize-y py-3 leading-6', className)}
        {...rest}
      />
    </FieldShell>
  );
});

export function FormError({ error }: { error?: string | null }) {
  const text = errorText(error);
  if (!text) return null;
  return (
    <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-callout font-semibold text-danger">
      {text}
    </p>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | null;
  hint?: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, id: idProp, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        className={clsx(inputClass, 'h-14 appearance-none bg-[length:20px] bg-[right_16px_center] bg-no-repeat pr-12', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

/** Галочка с подписью (соглашения, «Я ознакомился») */
export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-callout">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-6 shrink-0 cursor-pointer rounded-[8px] accent-[var(--p-accent)]"
        />
        <span className="pt-0.5">{children}</span>
      </label>
      {error && (
        <p role="alert" className="text-callout font-semibold text-danger">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}
