'use client';

import clsx from 'clsx';
import { t, type FullTaskStatus, type TranslationKey } from '@parri/shared';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label={t('common.loading')}
      className={clsx('inline-block size-6 animate-spin rounded-full border-[3px] border-text-3/30 border-t-accent', className)}
    />
  );
}

export function CenterSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-extrabold text-accent-text"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '•'}
    </span>
  );
}

const STATUS_TONE: Record<FullTaskStatus, string> = {
  open: 'bg-accent/12 text-accent-text',
  in_progress: 'bg-text/8 text-text',
  review: 'bg-warning/15 text-warning',
  disputed: 'bg-danger/12 text-danger',
  completed: 'bg-success/15 text-success',
  archived: 'bg-separator text-text-2',
};

export function StatusBadge({ status }: { status: FullTaskStatus }) {
  return (
    <span className={clsx('inline-flex h-7 items-center rounded-pill px-3 text-caption', STATUS_TONE[status])}>
      {t(`status.${status}` as TranslationKey)}
    </span>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-text-2">{icon}</div>}
      <h2 className="text-title3 font-bold">{title}</h2>
      {text && <p className="max-w-md text-body text-text-2">{text}</p>}
      {action}
    </div>
  );
}

export function PageTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title1 font-extrabold">{children}</h1>
      {subtitle && <p className="text-body text-text-2">{subtitle}</p>}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-title3 font-bold">{children}</h2>;
}
