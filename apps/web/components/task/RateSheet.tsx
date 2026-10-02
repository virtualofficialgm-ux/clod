'use client';

import { t, work, type TaskDetail, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation } from '@parri/shared/react';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { FormError, TextArea } from '@/components/ui/Field';
import { OptionTile } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

const ASPECTS = ['quality', 'communication', 'deadlines', 'requirements'] as const;
type Aspect = (typeof ASPECTS)[number];

function Stars({
  value,
  onChange,
  label,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  size?: number;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={String(n)}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            size={size}
            className={clsx(n <= value ? 'fill-accent text-accent' : 'text-text-3')}
          />
        </button>
      ))}
    </div>
  );
}

/** Отзыв после завершения задачи: заказчик → исполнителю и наоборот */
export function RateSheet({ d, onClose }: { d: TaskDetail; onClose: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState<Record<Aspect, number>>({
    quality: 0,
    communication: 0,
    deadlines: 0,
    requirements: 0,
  });
  const [pub, setPub] = useState('');
  const [priv, setPriv] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [again, setAgain] = useState<boolean | null>(null);
  const customer = d.viewer_role === 'customer';
  const send = useApiMutation(
    (sb) =>
      work.review_counterpart(sb, d.task.id, {
        rating,
        ...Object.fromEntries(ASPECTS.map((a) => [a, aspects[a] || null])),
        publicText: pub,
        privateText: priv,
        skills,
        workAgain: again,
      }),
    {
      invalidate: () => [keys.task(d.task.id), ['my-tasks']],
      onSuccess: () => {
        toast(t('rate.done'));
        onClose();
      },
    },
  );
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('rate.title')}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            block
            disabled={!rating || send.isPending}
            onClick={() => send.mutate(undefined)}
          >
            {t('rate.publish')}
          </Button>
          <p className="text-center text-caption text-text-2">{t('rate.immutable')}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2">
          <p className="font-bold">{t('rate.overall')}</p>
          <Stars value={rating} onChange={setRating} label={t('rate.overall')} size={40} />
          {rating > 0 && (
            <p className="text-callout text-text-2">
              {t(`rate.labels.${rating}` as TranslationKey)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-callout font-bold text-text-2">{t('rate.aspects')}</p>
          {ASPECTS.map((a) => (
            <div key={a} className="tile flex items-center justify-between gap-3 px-4 py-2">
              <span className="text-callout font-semibold">{t(`rate.${a}`)}</span>
              <Stars
                value={aspects[a]}
                onChange={(v) => setAspects((s) => ({ ...s, [a]: v }))}
                label={t(`rate.${a}`)}
                size={20}
              />
            </div>
          ))}
        </div>
        <TextArea
          label={t('rate.public')}
          hint={t('rate.publicHint')}
          value={pub}
          onChange={(e) => setPub(e.target.value)}
          rows={3}
          counterMax={1000}
        />
        <TextArea
          label={t('rate.private')}
          hint={t('rate.privateHint')}
          value={priv}
          onChange={(e) => setPriv(e.target.value)}
          rows={2}
          counterMax={1000}
        />
        {customer && d.task.skills.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-callout font-bold text-text-2">{t('rate.skills')}</p>
            <div className="flex flex-wrap gap-1.5">
              {d.task.skills.map((s) => {
                const on = skills.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSkills((x) => (on ? x.filter((y) => y !== s) : [...x, s]))}
                    className={clsx(
                      'rounded-pill px-3 py-1.5 text-caption font-semibold',
                      on ? 'bg-ink text-on-ink' : 'bg-fill',
                    )}
                  >
                    {t(`skill.${s}` as TranslationKey)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('rate.again')}>
          <p className="text-callout font-bold text-text-2">{t('rate.again')}</p>
          <div className="grid grid-cols-2 gap-2">
            <OptionTile
              selected={again === true}
              onClick={() => setAgain(true)}
              title={t('rate.yes')}
            />
            <OptionTile
              selected={again === false}
              onClick={() => setAgain(false)}
              title={t('rate.no')}
            />
          </div>
        </div>
        <FormError error={send.error?.key} />
      </div>
    </BottomSheet>
  );
}
