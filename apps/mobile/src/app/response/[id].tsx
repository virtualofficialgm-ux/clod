import { formatDateTime, formatMoney, responses, t, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useSupabase, useTaskDetail } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { ConfirmSheet, RespondSheet } from '@/components/task/Sheets';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { Center, EmptyState, Pill, Row, useToast } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

type Shown = 'pending' | 'viewed' | 'comparing' | 'accepted' | 'rejected' | 'withdrawn';

export default function ResponseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sb = useSupabase();
  const toast = useToast();
  const { colors } = useTheme();
  const q = useQuery({
    queryKey: ['response', id],
    queryFn: () => responses.mine(sb, id!),
    enabled: !!id,
  });
  const r = q.data;
  const detail = useTaskDetail(r?.task_id).data;
  const [sheet, setSheet] = useState<null | 'edit' | 'withdraw'>(null);
  const withdraw = useApiMutation((s) => responses.withdraw(s, id!), {
    invalidate: () => [['response', id!], keys.task(r?.task_id ?? ''), ['my-tasks']],
    onSuccess: () => {
      toast(t('task.withdrawn'));
      setSheet(null);
    },
  });

  if (q.isLoading)
    return (
      <Screen title="" leading={<BackButton />}>
        <Center />
      </Screen>
    );
  if (!r)
    return (
      <Screen title="" leading={<BackButton />}>
        <EmptyState title={t('task.notAvailable')} />
      </Screen>
    );

  const shown: Shown =
    r.status === 'pending'
      ? r.compared
        ? 'comparing'
        : r.viewed_at
          ? 'viewed'
          : 'pending'
      : (r.status as Shown);
  const steps: Shown[] = ['pending', 'viewed', 'comparing', 'accepted'];
  const idx = steps.indexOf(shown);
  const editable = r.status === 'pending' && r.tasks.status === 'open';
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: r.tasks.currency });

  return (
    <Screen
      title={t('respond.statusTitle')}
      leading={<BackButton />}
      onRefresh={() => q.refetch()}
      overlay={
        <>
          {sheet === 'edit' && detail && (
            <RespondSheet
              open
              onClose={() => {
                setSheet(null);
                void q.refetch();
              }}
              task={detail.task}
              existing={r}
            />
          )}
          <ConfirmSheet
            open={sheet === 'withdraw'}
            onClose={() => setSheet(null)}
            title={t('task.withdraw')}
            confirmLabel={t('task.withdraw')}
            onConfirm={() => withdraw.mutate(undefined)}
            busy={withdraw.isPending}
            error={withdraw.error?.key}
          />
        </>
      }
    >
      <Card>
        <AppText variant="callout" color="textSecondary">
          {r.tasks.title}
        </AppText>
        <AppText variant="title2" testID="response-status">
          {t(`respond.st.${shown}`)}
        </AppText>
        {idx >= 0 && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {steps.map((s, i) => (
              <View key={s} style={{ flex: 1, gap: 4 }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i <= idx ? colors.accent : colors.fill,
                  }}
                />
                <AppText
                  variant="caption"
                  color={i <= idx ? 'text' : 'textSecondary'}
                  numberOfLines={1}
                >
                  {t(`respond.st.${s}`)}
                </AppText>
              </View>
            ))}
          </View>
        )}
        {shown === 'accepted' && <AppText variant="callout">{t('respond.chosenText')}</AppText>}
        {shown === 'rejected' && (
          <AppText variant="callout" color="textSecondary">
            {t('respond.rejectedWhy')}
          </AppText>
        )}
        {shown === 'accepted' ? (
          <Button
            block
            label={t('task.openRoom')}
            onPress={() => router.push(`/task/${r.task_id}/room`)}
          />
        ) : (
          <Button
            variant="glass"
            block
            label={t('respond.goTask')}
            onPress={() => router.push(`/task/${r.task_id}`)}
          />
        )}
        {editable && (
          <Row>
            <Button variant="glass" label={t('respond.edit')} onPress={() => setSheet('edit')} />
            <Button
              variant="glass"
              label={t('task.withdraw')}
              onPress={() => setSheet('withdraw')}
            />
          </Row>
        )}
        {shown === 'rejected' && (
          <Button block label={t('respond.findSimilar')} onPress={() => router.push('/feed')} />
        )}
      </Card>
      <Card>
        <CardHeader title={t('respond.title')} />
        <ListGroup>
          <ListRow title={t('respond.responseId')} value={r.id.slice(0, 8)} />
          <ListRow title={t('respond.price')} value={fmt(r.price_cents)} />
          <ListRow title={t('respond.deadline')} value={t(`deadline.${r.deadline}`)} />
          <ListRow title={t('respond.ready')} value={t(`ready.${r.ready}`)} />
          <ListRow title={t('balance.date')} value={formatDateTime(r.created_at)} />
        </ListGroup>
        <AppText variant="body">{r.cover_letter}</AppText>
        {r.skills.length > 0 && (
          <Row>
            {r.skills.map((s) => (
              <Pill key={s}>{t(`skill.${s}` as TranslationKey)}</Pill>
            ))}
          </Row>
        )}
        {[...r.portfolio_links, ...(r.video_url ? [r.video_url] : [])].map((l) => (
          <AppText
            key={l}
            variant="callout"
            color="accentText"
            numberOfLines={1}
            onPress={() => Linking.openURL(l)}
          >
            {l}
          </AppText>
        ))}
      </Card>
    </Screen>
  );
}
