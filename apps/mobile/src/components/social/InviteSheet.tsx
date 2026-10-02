import { displayStatus, formatMoney, people, t } from '@parri/shared';
import { keys, useApiMutation, useMyTasks } from '@parri/shared/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { FormError, TextField } from '@/components/ui/TextField';
import { Label, Row, useToast } from '@/components/ui/bits';
import { OptionTile } from '@/components/ui/kit';

export function InviteSheet({
  user,
  onClose,
}: {
  user: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const mine = useMyTasks('customer');
  const open = (mine.data ?? []).filter((x) => displayStatus(x) === 'open');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [days, setDays] = useState<1 | 3 | 7>(3);
  const send = useApiMutation((sb) => people.invite(sb, taskId!, user!.id, message, days), {
    invalidate: () => [keys.invitations],
    onSuccess: () => {
      toast(t('invite.sent'));
      onClose();
    },
  });
  return (
    <BottomSheet
      open={!!user}
      onClose={onClose}
      title={`${t('invite.title')} · ${user?.name ?? ''}`}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={send.error?.key} />
          <Button
            size="lg"
            block
            label={t('invite.send')}
            disabled={!taskId || send.isPending}
            onPress={() => send.mutate(undefined)}
          />
          <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
            {t('invite.note')}
          </AppText>
        </View>
      }
    >
      <Label>{t('invite.chooseTask')}</Label>
      {open.length === 0 ? (
        <AppText variant="callout" color="textSecondary">
          {t('invite.noTasks')}
        </AppText>
      ) : (
        open.map((x) => (
          <OptionTile
            key={x.id}
            selected={taskId === x.id}
            onPress={() => setTaskId(x.id)}
            title={x.title}
            subtitle={formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}
          />
        ))
      )}
      <Button
        variant="glass"
        label={`+ ${t('invite.createNew')}`}
        onPress={() => {
          onClose();
          router.push('/task/new');
        }}
      />
      <TextField
        label={t('invite.message')}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
      />
      <Label>{t('invite.days')}</Label>
      <Row>
        {([1, 3, 7] as const).map((d) => (
          <Chip
            key={d}
            label={t(`invite.d.${d}`)}
            selected={days === d}
            onPress={() => setDays(d)}
          />
        ))}
      </Row>
    </BottomSheet>
  );
}
