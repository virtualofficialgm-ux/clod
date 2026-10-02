import {
  calcFee,
  formatAgo,
  formatMoney,
  responses,
  shortName,
  t,
  type ResponseWithExecutor,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useTaskDetail, useTaskResponses } from '@parri/shared/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { TextField } from '@/components/ui/TextField';
import { StatTile } from '@/components/ui/kit';
import { ConfirmSheet } from '@/components/task/Sheets';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import {
  Avatar,
  Card,
  Center,
  EmptyState,
  PageTitle,
  Pill,
  Row,
  useToast,
} from '@/components/ui/bits';
import { useTheme } from '@/theme/ThemeProvider';

export default function Responses() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const detail = useTaskDetail(id);
  const isCustomer = detail.data?.viewer_role === 'customer';
  const list = useTaskResponses(id, isCustomer);
  const [picked, setPicked] = useState<ResponseWithExecutor | null>(null);
  const task = detail.data?.task;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'match' | 'cheap' | 'new'>('match');
  const [onlyCompared, setOnlyCompared] = useState(false);
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task?.currency });
  const all = list.data ?? [];
  const newCount = all.filter((r) => !r.viewed_at && r.status === 'pending').length;
  const viewed = useRef(false);
  const markViewed = useApiMutation((sb) => responses.markViewed(sb, id!), {
    invalidate: () => [keys.responses(id!), ['my-tasks']],
  });
  useEffect(() => {
    if (isCustomer && newCount > 0 && !viewed.current) {
      viewed.current = true;
      markViewed.mutate(undefined);
    }
  }, [isCustomer, newCount, markViewed]);
  const compare = useApiMutation(
    (sb, v: { id: string; on: boolean }) => responses.setCompared(sb, v.id, v.on),
    { invalidate: () => [keys.responses(id!)] },
  );
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = all.filter(
      (r) =>
        (!needle ||
          `${r.first_name ?? ''} ${r.last_name ?? ''} ${r.cover_letter}`
            .toLowerCase()
            .includes(needle)) &&
        (!onlyCompared || r.compared),
    );
    const by = {
      match: (a: ResponseWithExecutor, b: ResponseWithExecutor) => b.match - a.match,
      cheap: (a: ResponseWithExecutor, b: ResponseWithExecutor) => a.price_cents - b.price_cents,
      new: (a: ResponseWithExecutor, b: ResponseWithExecutor) =>
        b.created_at.localeCompare(a.created_at),
    }[sort];
    return [...f].sort(by);
  }, [all, q, sort, onlyCompared]);
  const choose = useApiMutation((sb, rid: string) => responses.choose(sb, rid), {
    invalidate: () => [keys.task(id!), keys.responses(id!), keys.me, ['my-tasks']],
    onSuccess: () => {
      toast(t('responses.chosen'));
      setPicked(null);
      router.replace(`/task/${id}/room`);
    },
  });

  if (detail.isLoading || list.isLoading)
    return (
      <Screen title="" leading={<BackButton />}>
        <Center />
      </Screen>
    );
  if (!task || !isCustomer)
    return (
      <Screen title="" leading={<BackButton />}>
        <EmptyState title={t('task.notFound')} />
      </Screen>
    );

  const delta = (r: ResponseWithExecutor) =>
    r.price_cents + calcFee(r.price_cents) - (task.reward_cents + task.fee_cents);
  const canChoose = task.status === 'open' && !task.expired;

  return (
    <Screen
      title={t('responses.title')}
      leading={<BackButton />}
      onRefresh={() => list.refetch()}
      overlay={
        <ConfirmSheet
          open={!!picked}
          onClose={() => setPicked(null)}
          title={t('responses.chooseTitle')}
          text={
            picked ? (
              <View style={{ gap: 8 }}>
                <AppText variant="body" color="textSecondary">
                  {t('responses.chooseText', {
                    name: shortName(picked.first_name, picked.last_name),
                    price: fmt(picked.price_cents),
                    deadline: t(`deadline.${picked.deadline}`),
                  })}
                </AppText>
                {delta(picked) > 0 && (
                  <AppText variant="bodyStrong">
                    {t('responses.diffUp', { v: fmt(delta(picked)) })}
                  </AppText>
                )}
                {delta(picked) < 0 && (
                  <AppText variant="bodyStrong">
                    {t('responses.diffDown', { v: fmt(-delta(picked)) })}
                  </AppText>
                )}
              </View>
            ) : null
          }
          confirmLabel={t('responses.choose')}
          onConfirm={() => picked && choose.mutate(picked.id)}
          busy={choose.isPending}
          error={choose.error?.key}
        />
      }
    >
      <PageTitle subtitle={`${task.title} · ${fmt(task.reward_cents)}`}>
        {t('responses.title')}
      </PageTitle>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <StatTile value={String(all.length)} label={t('responses.counters.total')} />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile value={String(newCount)} label={t('responses.counters.new')} />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            value={String(all.filter((r) => r.compared).length)}
            label={t('responses.counters.compared')}
          />
        </View>
      </View>
      {all.length > 0 && (
        <>
          <TextField label={t('responses.search')} value={q} onChangeText={setQ} />
          <Segmented
            value={sort}
            onChange={setSort}
            options={(['match', 'cheap', 'new'] as const).map((v) => ({
              value: v,
              label: t(`responses.sort.${v}`),
            }))}
          />
          <Row>
            <Chip
              label={`${t('responses.compare')} · ${all.filter((r) => r.compared).length}`}
              selected={onlyCompared}
              onPress={() => setOnlyCompared((v) => !v)}
            />
          </Row>
        </>
      )}
      {items.length === 0 ? (
        <EmptyState title={t('responses.empty')} text={t('responses.emptyHint')} />
      ) : (
        items.map((r) => {
          const name = shortName(r.first_name, r.last_name);
          const diff = r.price_cents - task.reward_cents;
          return (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={name} url={r.avatar_url} size={48} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">
                    {name}
                    {!r.viewed_at && r.status === 'pending' ? ` · ${t('responses.new')}` : ''}
                  </AppText>
                  <AppText variant="callout" color="textSecondary">
                    {r.rating_avg
                      ? `★ ${Number(r.rating_avg).toFixed(1)} · `
                      : `${t('responses.noRating')} · `}
                    {t('responses.completed', { n: r.completed_count })}
                  </AppText>
                </View>
                <Pill>{t('responses.match', { n: r.match })}</Pill>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: colors.fill,
                  borderRadius: 16,
                  padding: 12,
                }}
              >
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <AppText variant="caption" color="textSecondary">
                    {t('respond.price')}
                  </AppText>
                  <AppText variant="title3" color="accentText" tabular>
                    {fmt(r.price_cents)}
                  </AppText>
                  {diff !== 0 && (
                    <AppText variant="caption" color="textSecondary" tabular>
                      {diff > 0 ? '+' : '−'}
                      {fmt(Math.abs(diff))}
                    </AppText>
                  )}
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <AppText variant="caption" color="textSecondary">
                    {t('respond.deadline')}
                  </AppText>
                  <AppText variant="bodyStrong">{t(`deadline.${r.deadline}`)}</AppText>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <AppText variant="caption" color="textSecondary">
                    {t('respond.ready')}
                  </AppText>
                  <AppText variant="bodyStrong">{t(`ready.${r.ready}`)}</AppText>
                </View>
              </View>
              <AppText variant="body">{r.cover_letter}</AppText>
              {r.skills.length > 0 && (
                <Row>
                  {r.skills.map((s) => (
                    <Pill key={s}>{t(`skill.${s}` as TranslationKey)}</Pill>
                  ))}
                </Row>
              )}
              {r.status === 'pending' && (
                <Button
                  variant="glass"
                  label={r.compared ? t('responses.compareRemove') : t('responses.compareAdd')}
                  onPress={() => compare.mutate({ id: r.id, on: !r.compared })}
                />
              )}
              {[...r.portfolio_links, ...(r.video_url ? [r.video_url] : [])].map((l) => (
                <AppText
                  key={l}
                  variant="callout"
                  color="accentText"
                  onPress={() => Linking.openURL(l)}
                >
                  {l}
                </AppText>
              ))}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText variant="caption" color="textSecondary">
                  {formatAgo(r.created_at)}
                </AppText>
                {r.status === 'pending' && canChoose ? (
                  <Button label={t('responses.choose')} onPress={() => setPicked(r)} />
                ) : (
                  <AppText variant="bodyStrong">
                    {t(`responseStatus.${r.status}` as TranslationKey)}
                  </AppText>
                )}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
