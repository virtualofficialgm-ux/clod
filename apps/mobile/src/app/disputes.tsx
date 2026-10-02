import {
  DISPUTE_DESIRED,
  DISPUTE_REASONS,
  disputeTimeLeft,
  disputes,
  displayStatus,
  formatDateTime,
  formatDuration,
  formatMoney,
  parseDollars,
  t,
  type DisputeDesired,
  type DisputeReason,
  type TranslationKey,
} from '@parri/shared';
import { useApiMutation, useMe, useMyTasks, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { Lock } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Center, EmptyState, Label, PageTitle, Row, useToast } from '@/components/ui/bits';
import { Card, CardHeader, OptionTile } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

function NewDispute() {
  const toast = useToast();
  const asExec = useMyTasks('executor');
  const asCust = useMyTasks('customer');
  const eligible = useMemo(
    () =>
      [...(asExec.data ?? []), ...(asCust.data ?? [])].filter((x) =>
        ['in_progress', 'review'].includes(displayStatus(x)),
      ),
    [asExec.data, asCust.data],
  );
  const [kind, setKind] = useState<'task' | 'account'>('task');
  const [taskId, setTaskId] = useState('');
  const [reason, setReason] = useState<DisputeReason>('mismatch');
  const [details, setDetails] = useState('');
  const [desired, setDesired] = useState<DisputeDesired>('refund');
  const [amount, setAmount] = useState('');
  const [truthful, setTruthful] = useState(false);
  const open = useApiMutation(
    (sb) =>
      disputes.open(sb, {
        kind,
        taskId: kind === 'task' ? taskId : null,
        reason,
        details,
        desired,
        amountCents: amount ? parseDollars(amount) : null,
        truthful,
      }),
    {
      invalidate: () => [['disputes'], ['my-tasks']],
      onSuccess: () => {
        toast(t('disputes.sent'));
        setDetails('');
        setTruthful(false);
      },
    },
  );
  return (
    <Card testID="dispute-form">
      <CardHeader title={t('disputes.new')} />
      <Segmented
        value={kind}
        onChange={setKind}
        options={(['task', 'account'] as const).map((v) => ({
          value: v,
          label: t(`disputes.kinds.${v}`),
        }))}
      />
      {kind === 'task' ? (
        eligible.length ? (
          eligible.map((x) => (
            <OptionTile
              key={x.id}
              selected={taskId === x.id}
              onPress={() => setTaskId(x.id)}
              title={x.title}
              subtitle={formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}
            />
          ))
        ) : (
          <AppText variant="callout" color="textSecondary">
            {t('disputes.noTasks')}
          </AppText>
        )
      ) : null}
      {kind === 'task' && taskId ? (
        <Button
          variant="glass"
          label={t('disputes.openChat')}
          onPress={() => router.push(`/task/${taskId}/room`)}
        />
      ) : null}
      <Label>{t('disputes.reason')}</Label>
      <Row>
        {DISPUTE_REASONS.map((r) => (
          <Chip
            key={r}
            label={t(`disputes.reasons.${r}`)}
            selected={reason === r}
            onPress={() => setReason(r)}
          />
        ))}
      </Row>
      <TextField
        label={t('disputes.details')}
        placeholder={t('disputes.detailsPlaceholder')}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={2000}
      />
      <Label>{t('disputes.desired')}</Label>
      <Row>
        {DISPUTE_DESIRED.map((d) => (
          <Chip
            key={d}
            label={t(`disputes.desires.${d}`)}
            selected={desired === d}
            onPress={() => setDesired(d)}
          />
        ))}
      </Row>
      {kind === 'task' ? (
        <TextField
          label={t('disputes.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
      ) : null}
      <Checkbox checked={truthful} onChange={setTruthful} label={t('disputes.truthful')} />
      <FormError error={open.error?.key} />
      <Button
        size="lg"
        block
        label={t('disputes.submit')}
        disabled={
          open.isPending || !truthful || details.trim().length < 20 || (kind === 'task' && !taskId)
        }
        onPress={() => open.mutate(undefined)}
      />
    </Card>
  );
}

export default function Disputes() {
  const sb = useSupabase();
  const me = useMe();
  const { colors } = useTheme();
  const list = useQuery({ queryKey: ['disputes'], queryFn: () => disputes.mine(sb) });
  const pro = me.data?.profile.plan === 'pro';
  return (
    <Screen title={t('disputes.title')} leading={<BackButton />} onRefresh={() => list.refetch()}>
      <PageTitle>{t('disputes.title')}</PageTitle>
      {pro ? (
        <NewDispute />
      ) : (
        <Card testID="disputes-pro">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Lock size={18} color={colors.text} />
            <AppText variant="title3">{t('disputes.proOnly')}</AppText>
          </View>
          <AppText variant="callout" color="textSecondary">
            {t('disputes.proText')}
          </AppText>
          <Button label={t('disputes.toPro')} onPress={() => router.push('/subscription')} />
          <Button
            variant="glass"
            label={t('disputes.writeSupport')}
            onPress={() => router.push('/support')}
          />
        </Card>
      )}
      <Label>{t('disputes.mine')}</Label>
      {list.isLoading ? (
        <Center />
      ) : !list.data?.length ? (
        <EmptyState title={t('disputes.empty')} />
      ) : (
        list.data.map((d) => (
          <Card key={d.id} testID="dispute">
            <AppText variant="bodyStrong">{d.task_title ?? t('disputes.kinds.account')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t(`disputes.status.${d.status}`)} · {formatDateTime(d.created_at)}
            </AppText>
            {['pending', 'in_progress'].includes(d.status) ? (
              <AppText variant="callout">
                {t('disputes.timer', { left: formatDuration(disputeTimeLeft(d.deadline_at)) })}
              </AppText>
            ) : null}
            {d.decision ? (
              <AppText variant="bodyStrong" color="accentText">
                {t(`disputes.decision.${d.decision}`)}
              </AppText>
            ) : null}
            {d.events.map((e, i) => (
              <AppText key={i} variant="caption" color="textSecondary">
                • {t(`disputes.ev.${e.kind}` as TranslationKey)} · {formatDateTime(e.at)}
              </AppText>
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}
