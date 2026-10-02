import clsx from 'clsx';
import { Check } from 'lucide-react';
import { t } from '@parri/shared';

const STEPS = ['stepAccount', 'stepProfile', 'stepSkills', 'stepDone'] as const;

/** Шаги регистрации: аккаунт → профиль → навыки → готово */
export function Stepper({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={t('register.title')}>
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className="flex flex-col gap-2">
          <span className={clsx('h-1.5 rounded-pill', i <= current ? 'bg-accent' : 'bg-text-3/25')} />
          <span className={clsx('flex items-center gap-1 text-caption', i === current ? 'text-text' : 'text-text-2')}>
            {i < current && <Check size={14} strokeWidth={3} aria-hidden />}
            {t(`register.${s}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
