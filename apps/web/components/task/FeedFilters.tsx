'use client';

import { CATEGORIES, DEADLINES, SORTS, formatDistance, formatMoney, t, type FeedParams } from '@parri/shared';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Input } from '@/components/ui/Field';

const PAY_STEPS = [null, 1000, 5000, 20000] as const;
const DISTANCES = [null, 500, 1000, 3000, 10000] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  value: FeedParams;
  onApply: (v: FeedParams) => void;
  onSave: (name: string, v: FeedParams) => void;
}

/** Шторка фильтров ленты: сортировка, категория, оплата, срок, расстояние; сохранение поиска */
export function FeedFilters({ open, onClose, value, onApply, onSave }: Props) {
  const [draft, setDraft] = useState<FeedParams>(value);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const sorts = SORTS.filter((s) => s !== 'distance' || value.kind === 'nearby');

  const toggle = <T,>(list: T[] | undefined, item: T) =>
    list?.includes(item) ? list.filter((x) => x !== item) : [...(list ?? []), item];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('feed.filters')}
      footer={
        <div className="flex flex-col gap-3">
          {saving ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label={t('feed.saveName')} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
              </div>
              <Button
                disabled={!name.trim()}
                onClick={() => {
                  onSave(name.trim(), draft);
                  setSaving(false);
                  setName('');
                }}
              >
                {t('common.save')}
              </Button>
            </div>
          ) : (
            <Button variant="glass" block onClick={() => setSaving(true)}>
              {t('feed.saveSearch')}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="glass" onClick={() => setDraft({ kind: value.kind, query: value.query })}>
              {t('feed.reset')}
            </Button>
            <Button size="lg" block onClick={() => onApply(draft)}>
              {t('feed.apply')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <Group title={t('feed.sort')}>
          {sorts.map((s) => (
            <Chip key={s} selected={(draft.sort ?? 'recommended') === s} onClick={() => setDraft({ ...draft, sort: s })}>
              {t(`sort.${s}`)}
            </Chip>
          ))}
        </Group>
        <Group title={t('feed.category')}>
          {CATEGORIES.map((c) => (
            <Chip key={c} selected={draft.categories?.includes(c)} onClick={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })}>
              {t(`category.${c}`)}
            </Chip>
          ))}
        </Group>
        <Group title={t('feed.pay')}>
          {PAY_STEPS.map((p) => (
            <Chip key={String(p)} selected={(draft.minRewardCents ?? null) === p} onClick={() => setDraft({ ...draft, minRewardCents: p })}>
              {p === null ? t('common.any') : t('feed.payFrom', { v: formatMoney(p) })}
            </Chip>
          ))}
        </Group>
        <Group title={t('feed.deadline')}>
          {DEADLINES.map((d) => (
            <Chip key={d} selected={draft.deadlines?.includes(d)} onClick={() => setDraft({ ...draft, deadlines: toggle(draft.deadlines, d) })}>
              {t(`deadline.${d}`)}
            </Chip>
          ))}
        </Group>
        {value.kind === 'nearby' && (
          <Group title={t('feed.distance')}>
            {DISTANCES.map((d) => (
              <Chip key={String(d)} selected={(draft.maxDistanceM ?? null) === d} onClick={() => setDraft({ ...draft, maxDistanceM: d })}>
                {d === null ? t('common.any') : t('feed.within', { v: formatDistance(d) })}
              </Chip>
            ))}
          </Group>
        )}
      </div>
    </BottomSheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-callout font-bold text-text-2">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Сколько фильтров отличается от умолчаний */
export function activeFilterCount(p: FeedParams): number {
  return (
    (p.sort && p.sort !== 'recommended' ? 1 : 0) +
    (p.categories?.length ? 1 : 0) +
    (p.minRewardCents ? 1 : 0) +
    (p.deadlines?.length ? 1 : 0) +
    (p.maxDistanceM ? 1 : 0)
  );
}
