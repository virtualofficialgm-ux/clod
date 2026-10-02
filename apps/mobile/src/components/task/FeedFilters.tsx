import {
  CATEGORIES,
  DEADLINES,
  SORTS,
  formatDistance,
  formatMoney,
  t,
  type FeedParams,
} from '@parri/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { TextField } from '@/components/ui/TextField';
import { Label, Row } from '@/components/ui/bits';

const PAY = [null, 1000, 5000, 20000] as const;
const DIST = [null, 500, 1000, 3000, 10000] as const;

export function activeFilterCount(p: FeedParams): number {
  return (
    (p.sort && p.sort !== 'recommended' && p.sort !== 'distance' ? 1 : 0) +
    (p.categories?.length ? 1 : 0) +
    (p.minRewardCents ? 1 : 0) +
    (p.deadlines?.length ? 1 : 0) +
    (p.maxDistanceM ? 1 : 0)
  );
}

export function FeedFilters({
  open,
  onClose,
  value,
  onApply,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  value: FeedParams;
  onApply: (v: FeedParams) => void;
  onSave: (name: string, v: FeedParams) => void;
}) {
  const [d, setD] = useState<FeedParams>(value);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const toggle = <T,>(list: T[] | undefined, x: T) =>
    list?.includes(x) ? list.filter((y) => y !== x) : [...(list ?? []), x];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('feed.filters')}
      footer={
        <View style={{ gap: 10 }}>
          {saving ? (
            <View style={{ gap: 8 }}>
              <TextField
                label={t('feed.saveName')}
                value={name}
                onChangeText={setName}
                maxLength={60}
              />
              <Button
                variant="glass"
                block
                label={t('common.save')}
                disabled={!name.trim()}
                onPress={() => {
                  onSave(name.trim(), d);
                  setSaving(false);
                  setName('');
                }}
              />
            </View>
          ) : (
            <Button
              variant="glass"
              block
              label={t('feed.saveSearch')}
              onPress={() => setSaving(true)}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              variant="glass"
              label={t('feed.reset')}
              onPress={() => setD({ kind: value.kind, query: value.query })}
            />
            <Button
              size="lg"
              label={t('feed.apply')}
              style={{ flex: 1 }}
              block
              onPress={() => onApply(d)}
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: 10 }}>
        <Label>{t('feed.sort')}</Label>
        <Row>
          {SORTS.filter((s) => s !== 'distance' || value.kind === 'nearby').map((s) => (
            <Chip
              key={s}
              label={t(`sort.${s}`)}
              selected={(d.sort ?? 'recommended') === s}
              onPress={() => setD({ ...d, sort: s })}
            />
          ))}
        </Row>
      </View>
      <View style={{ gap: 10 }}>
        <Label>{t('feed.category')}</Label>
        <Row>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(`category.${c}`)}
              selected={d.categories?.includes(c)}
              onPress={() => setD({ ...d, categories: toggle(d.categories, c) })}
            />
          ))}
        </Row>
      </View>
      <View style={{ gap: 10 }}>
        <Label>{t('feed.pay')}</Label>
        <Row>
          {PAY.map((p) => (
            <Chip
              key={String(p)}
              label={p === null ? t('common.any') : t('feed.payFrom', { v: formatMoney(p) })}
              selected={(d.minRewardCents ?? null) === p}
              onPress={() => setD({ ...d, minRewardCents: p })}
            />
          ))}
        </Row>
      </View>
      <View style={{ gap: 10 }}>
        <Label>{t('feed.deadline')}</Label>
        <Row>
          {DEADLINES.map((x) => (
            <Chip
              key={x}
              label={t(`deadline.${x}`)}
              selected={d.deadlines?.includes(x)}
              onPress={() => setD({ ...d, deadlines: toggle(d.deadlines, x) })}
            />
          ))}
        </Row>
      </View>
      {value.kind === 'nearby' && (
        <View style={{ gap: 10 }}>
          <Label>{t('feed.distance')}</Label>
          <Row>
            {DIST.map((x) => (
              <Chip
                key={String(x)}
                label={x === null ? t('common.any') : t('feed.within', { v: formatDistance(x) })}
                selected={(d.maxDistanceM ?? null) === x}
                onPress={() => setD({ ...d, maxDistanceM: x })}
              />
            ))}
          </Row>
        </View>
      )}
    </BottomSheet>
  );
}
