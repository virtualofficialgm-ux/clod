'use client';

/**
 * Набор компонентов в духе Cal AI: белые карточки с мягкой тенью, серые плитки выбора,
 * крупные цифры, кольца прогресса, полоса дней недели. Стекло — только на навигации.
 */
import clsx from 'clsx';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { t } from '@parri/shared';
import { PRESS_SCALE, springs } from '@/lib/springs';

// ---------- Карточка ----------
export function Card({
  children,
  className,
  as: Tag = 'section',
  ...rest
}: { children: React.ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={clsx('card p-5 md:p-6', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, action, stack }: { title: React.ReactNode; action?: React.ReactNode; stack?: boolean }) {
  return (
    <div className={clsx('mb-4 flex justify-between gap-3', stack ? 'flex-col sm:flex-row sm:items-center' : 'items-center')}>
      <h2 className="text-title3 font-bold">{title}</h2>
      {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  );
}

// ---------- Плитка выбора ----------
interface OptionTileProps {
  selected?: boolean;
  onClick?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** checkbox — несколько вариантов; radio — один */
  role?: 'radio' | 'checkbox';
  disabled?: boolean;
  className?: string;
}

/** Крупная серая плитка; выбранная становится «чернильной» — как варианты ответов в Cal AI */
export function OptionTile({ selected, onClick, title, subtitle, icon, role = 'radio', disabled, className }: OptionTileProps) {
  return (
    <motion.button
      type="button"
      role={role}
      aria-checked={!!selected}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={springs.press}
      className={clsx(
        'flex min-h-16 w-full items-center gap-4 rounded-md px-5 py-4 text-left transition-colors disabled:opacity-45',
        selected ? 'bg-ink text-on-ink' : 'bg-fill text-text hover:bg-fill-strong',
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={clsx(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            selected ? 'bg-on-ink/15' : 'bg-card-solid',
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-bold">{title}</span>
        {subtitle && <span className={clsx('text-callout', selected ? 'opacity-75' : 'text-text-2')}>{subtitle}</span>}
      </span>
      {role === 'checkbox' && (
        <span
          aria-hidden
          className={clsx(
            'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
            selected ? 'border-on-ink bg-on-ink text-ink' : 'border-text-3/50',
          )}
        >
          {selected && <Check size={14} strokeWidth={3.2} />}
        </span>
      )}
    </motion.button>
  );
}

// ---------- Шаги: кнопка «назад» в круге и тонкая полоса прогресса ----------
export function StepHeader({
  step,
  total,
  onBack,
  backHref,
  trailing,
}: {
  step: number;
  total: number;
  onBack?: () => void;
  backHref?: string;
  trailing?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const back = (
    <span className="flex size-11 items-center justify-center rounded-full bg-fill text-text transition-colors hover:bg-fill-strong">
      <ChevronLeft size={22} strokeWidth={2.6} />
    </span>
  );
  return (
    <div className="flex items-center gap-4">
      {backHref ? (
        <Link href={backHref} aria-label={t('common.back')}>
          {back}
        </Link>
      ) : onBack ? (
        <button type="button" onClick={onBack} aria-label={t('common.back')}>
          {back}
        </button>
      ) : (
        <span className="size-11" />
      )}
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-pill bg-fill"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={t('common.stepOf', { step, total })}
      >
        <motion.div
          className="h-full rounded-pill bg-ink"
          initial={false}
          animate={{ width: `${(step / total) * 100}%` }}
          transition={reduce ? { duration: 0 } : springs.appear}
        />
      </div>
      {trailing ?? <span className="w-11" />}
    </div>
  );
}

/** Заголовок шага: крупный вопрос и пояснение под ним */
export function StepTitle({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title2 font-extrabold">{title}</h1>
      {subtitle && <p className="text-body text-text-2">{subtitle}</p>}
    </div>
  );
}

// ---------- Кольцо прогресса ----------
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = 'var(--p-accent)',
  track = 'var(--p-fill)',
  children,
  label,
  className,
}: {
  /** 0..1 */
  value: number;
  /** Размер контейнера классами (кольцо масштабируется по viewBox) */
  className?: string;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={clsx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={className ? undefined : { width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={reduce ? { duration: 0 } : { ...springs.appear, delay: 0.1 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

// ---------- Маленькая карточка показателя с кольцом ----------
export function StatTile({
  value,
  label,
  ring,
  color,
  icon,
  href,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  ring?: number;
  color?: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="card flex h-full flex-col gap-3 p-4">
      <div className="flex flex-col">
        <span className="tabular text-title3 font-extrabold">{value}</span>
        <span className="text-caption text-text-2">{label}</span>
      </div>
      {ring != null ? (
        <ProgressRing value={ring} size={64} stroke={7} color={color}>
          <span style={{ color }}>{icon}</span>
        </ProgressRing>
      ) : (
        icon && <span className="flex size-10 items-center justify-center rounded-full bg-fill" style={{ color }}>{icon}</span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-lg transition-transform active:scale-[0.98]">
      {body}
    </Link>
  ) : (
    body
  );
}

// ---------- Полоса дней (дедлайны) ----------
export function WeekStrip({
  marks,
  selected,
  onSelect,
}: {
  /** Даты (YYYY-MM-DD), на которые есть дедлайны */
  marks: Set<string>;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 2 + i);
    return d;
  });
  const fmtWd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
  return (
    <div className="flex justify-between gap-1" role="tablist" aria-label={t('dashboard.deadlines')}>
      {days.map((d) => {
        const key = dayKey(d);
        const active = key === selected;
        const marked = marks.has(key);
        const isToday = key === dayKey(today);
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(key)}
            className={clsx(
              'flex w-full max-w-14 flex-col items-center gap-1.5 rounded-pill py-2 transition-colors',
              active ? 'bg-card-solid shadow-[0_4px_16px_var(--p-card-shadow)]' : 'hover:bg-fill',
            )}
          >
            <span className={clsx('text-caption capitalize', isToday ? 'text-text' : 'text-text-2')}>{fmtWd.format(d).replace('.', '')}</span>
            <span
              className={clsx(
                'tabular flex size-9 items-center justify-center rounded-full border-2 text-callout font-extrabold',
                marked ? 'border-accent text-text' : 'border-dashed border-text-3/40 text-text-2',
                isToday && marked && 'bg-accent text-on-accent',
              )}
            >
              {d.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- Списки настроек ----------
export function ListGroup({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="px-1 text-callout font-bold text-text-2">{title}</h2>}
      <div className="card divide-y divide-separator overflow-hidden p-0">{children}</div>
    </section>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  href,
  onClick,
  trailing,
  danger,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
}) {
  const inner = (
    <>
      {icon && (
        <span aria-hidden className={clsx('flex size-10 shrink-0 items-center justify-center rounded-full bg-fill', danger ? 'text-danger' : 'text-text')}>
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={clsx('truncate text-body font-semibold', danger && 'text-danger')}>{title}</span>
        {subtitle && <span className="truncate text-callout text-text-2">{subtitle}</span>}
      </span>
      {value != null && <span className="shrink-0 text-callout font-semibold text-text-2">{value}</span>}
      {trailing ?? ((href || onClick) && <ChevronRight size={20} className="shrink-0 text-text-3" aria-hidden />)}
    </>
  );
  const cls = 'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fill/60';
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

// ---------- Переключатель ----------
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-8 w-[52px] shrink-0 rounded-pill transition-colors', checked ? 'bg-accent' : 'bg-fill-strong')}
    >
      <motion.span
        layout
        transition={springs.press}
        className={clsx('absolute top-1 size-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)]', checked ? 'right-1' : 'left-1')}
      />
    </button>
  );
}

// ---------- Крупная цифра с подписью ----------
export function BigNumber({ value, label, accent }: { value: React.ReactNode; label?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={clsx('tabular text-number font-extrabold', accent && 'text-accent-text')}>{value}</span>
      {label && <span className="text-callout font-semibold text-text-2">{label}</span>}
    </div>
  );
}

// ---------- Полоса прогресса ----------
export function ProgressBar({ value, color = 'var(--p-accent)', label }: { value: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 overflow-hidden rounded-pill bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="h-full rounded-pill transition-[width] duration-500" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

// ---------- Плитка-кнопка быстрого действия ----------
export function QuickAction({ icon, label, href, onClick }: { icon: React.ReactNode; label: string; href?: string; onClick?: () => void }) {
  const cls = 'flex flex-col items-center gap-2 text-center';
  const inner = (
    <>
      <motion.span whileTap={{ scale: PRESS_SCALE }} transition={springs.press} className="flex size-14 items-center justify-center rounded-full bg-fill text-text">
        {icon}
      </motion.span>
      <span className="text-caption text-text">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

// ---------- Столбчатый график (доход по неделям) ----------
export function BarChart({ data, format, label }: { data: { label: string; value: number }[]; format: (v: number) => string; label: string }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="flex flex-col gap-3" aria-label={label}>
      <div className="flex h-36 items-end gap-2">
        {data.map((d, i) => {
          const h = Math.max(4, (d.value / max) * 100);
          const last = i === data.length - 1;
          return (
            <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.label}: ${format(d.value)}`}>
              {d.value > 0 && <span className="tabular text-[11px] font-bold text-text-2">{format(d.value)}</span>}
              <motion.span
                className={clsx('w-full max-w-10 rounded-[10px]', last ? 'bg-accent' : d.value > 0 ? 'bg-ink' : 'bg-fill')}
                initial={reduce ? false : { height: 0 }}
                animate={{ height: `${h}%` }}
                transition={reduce ? { duration: 0 } : { ...springs.appear, delay: i * 0.04 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[11px] font-semibold text-text-2">
            {d.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}
      </figcaption>
    </figure>
  );
}

/** Плашка «Скоро» для недоступных вариантов */
export function SoonBadge() {
  return <span className="rounded-pill bg-fill-strong px-2.5 py-0.5 text-caption text-text-2">{t('common.soon')}</span>;
}
