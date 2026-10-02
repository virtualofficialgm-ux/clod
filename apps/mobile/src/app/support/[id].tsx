import { formatDateTime, privateDocs, support, t } from '@parri/shared';
import { useApiMutation, useMe, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Center, EmptyState, useToast } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

export default function Ticket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sb = useSupabase();
  const me = useMe();
  const toast = useToast();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const ticket = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => support.ticket(sb, id!),
    enabled: !!id,
  });
  const msgs = useQuery({
    queryKey: ['ticket-messages', id],
    queryFn: () => support.messages(sb, id!),
    enabled: !!id,
    refetchInterval: 8000,
  });
  const reply = useApiMutation((s) => support.reply(s, id!, text.trim()), {
    invalidate: () => [['ticket-messages', id!], ['ticket', id!], ['tickets']],
    onSuccess: () => setText(''),
  });
  const resolve = useApiMutation((s) => support.setStatus(s, id!, 'resolved'), {
    invalidate: () => [['ticket', id!], ['tickets']],
    onSuccess: () => toast(t('common.done')),
  });
  if (ticket.isLoading)
    return (
      <Screen title="" leading={<BackButton />}>
        <Center />
      </Screen>
    );
  const tk = ticket.data;
  if (!tk)
    return (
      <Screen title="" leading={<BackButton />}>
        <EmptyState title={t('profile.notFound')} />
      </Screen>
    );
  return (
    <Screen
      title={tk.subject}
      leading={<BackButton />}
      onRefresh={() => msgs.refetch()}
      footer={
        tk.status !== 'closed' ? (
          <View style={{ gap: 8 }}>
            <TextField
              label={t('support.replyPlaceholder')}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={4000}
            />
            <FormError error={reply.error?.key} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['open', 'waiting'].includes(tk.status) ? (
                <Button
                  variant="glass"
                  label={t('support.markResolved')}
                  onPress={() => resolve.mutate(undefined)}
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Button
                  block
                  label={t('support.reply')}
                  disabled={!text.trim() || reply.isPending}
                  onPress={() => reply.mutate(undefined)}
                />
              </View>
            </View>
          </View>
        ) : undefined
      }
    >
      <Card>
        <AppText variant="title3">{tk.subject}</AppText>
        <AppText variant="caption" color="textSecondary">
          {t(`support.categories.${tk.category}`)} · {formatDateTime(tk.created_at)}
        </AppText>
        <AppText variant="bodyStrong" testID="ticket-status">
          {t(`support.status.${tk.status}`)}
        </AppText>
      </Card>
      {(msgs.data ?? []).map((m) => {
        const mine = m.author_id === me.data?.profile.id;
        return (
          <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
            <AppText variant="caption" color="textSecondary">
              {m.from_staff ? t('support.team') : mine ? t('support.you') : ''} ·{' '}
              {formatDateTime(m.created_at)}
            </AppText>
            <View
              style={{
                maxWidth: '85%',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: mine ? colors.accent : colors.fill,
              }}
            >
              <AppText variant="body" color={mine ? 'onAccent' : 'text'}>
                {m.body}
              </AppText>
              {m.files.map((f) => (
                <AppText
                  key={f.path}
                  variant="callout"
                  color={mine ? 'onAccent' : 'accentText'}
                  onPress={async () => Linking.openURL(await privateDocs.signedUrl(sb, f.path))}
                >
                  📎 {f.name}
                </AppText>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
