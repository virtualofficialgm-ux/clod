import {
  BOT_PROMPTS,
  bot,
  formatMoney,
  t,
  type MoneyCurrency,
  type TranslationKey,
} from '@parri/shared';
import { useApiMutation, useMe, useSupabase } from '@parri/shared/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { ArrowUp, Bot, Trash2 } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { PageTitle, Row } from '@/components/ui/bits';
import { Card, ListGroup, ListRow } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

export default function BotScreen() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const me = useMe();
  const { colors } = useTheme();
  const pro = me.data?.profile.plan === 'pro';
  const history = useQuery({ queryKey: ['bot'], queryFn: () => bot.history(sb), enabled: pro });
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const ask = useApiMutation((s, msg: string) => bot.ask(s, msg));
  const clear = useApiMutation((s) => bot.clear(s), { invalidate: () => [['bot']] });
  const send = (msg: string) => {
    if (!msg.trim() || ask.isPending) return;
    setPending(msg.trim());
    setText('');
    ask.mutate(msg.trim(), {
      onSettled: async () => {
        await qc.invalidateQueries({ queryKey: ['bot'] });
        setPending(null);
      },
    });
  };
  if (!pro)
    return (
      <Screen title={t('bot.title')} leading={<BackButton />}>
        <View testID="bot-pro" style={{ alignItems: 'center', gap: 12, paddingTop: 24 }}>
          <Bot size={48} color={colors.accent} />
          <AppText variant="title2" style={{ textAlign: 'center' }}>
            {t('bot.proOnly')}
          </AppText>
          <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            {t('bot.proText')}
          </AppText>
          <Button label={t('bot.toPro')} onPress={() => router.push('/subscription')} />
        </View>
      </Screen>
    );
  const messages = [
    ...(history.data ?? []),
    ...(pending
      ? [{ id: -1, role: 'user' as const, body: pending, tasks: [], created_at: '' }]
      : []),
  ];
  return (
    <Screen
      title={t('bot.title')}
      leading={<BackButton />}
      actions={
        <Button
          variant="glass"
          size="icon"
          accessibilityLabel={t('bot.clear')}
          icon={<Trash2 size={18} color={colors.text} />}
          onPress={() => clear.mutate(undefined)}
        />
      }
      footer={
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('bot.placeholder')}
              value={text}
              onChangeText={setText}
              maxLength={1000}
              onSubmitEditing={() => send(text)}
            />
          </View>
          <Button
            size="icon"
            accessibilityLabel={t('bot.send')}
            icon={<ArrowUp size={20} color={colors.onAccent} />}
            disabled={!text.trim() || ask.isPending}
            onPress={() => send(text)}
          />
        </View>
      }
    >
      <PageTitle subtitle={t('bot.intro')}>PARRI</PageTitle>
      <Row>
        {BOT_PROMPTS.map((p) => (
          <Chip key={p} label={t(`bot.prompts.${p}`)} onPress={() => send(t(`bot.prompts.${p}`))} />
        ))}
      </Row>
      <View testID="bot-messages" style={{ gap: 10 }}>
        {messages.map((m) => (
          <View
            key={m.id}
            style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}
          >
            <View
              style={{
                maxWidth: '85%',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: m.role === 'user' ? colors.accent : colors.fill,
              }}
            >
              <AppText variant="body" color={m.role === 'user' ? 'onAccent' : 'text'}>
                {m.body}
              </AppText>
            </View>
            {m.tasks.length ? (
              <ListGroup>
                {m.tasks.map((x) => (
                  <ListRow
                    key={x.id}
                    title={x.title}
                    subtitle={t(`category.${x.category}` as TranslationKey)}
                    value={formatMoney(x.reward_cents, 'ru-RU', {
                      currency: x.currency as MoneyCurrency,
                    })}
                    onPress={() => router.push(`/task/${x.id}`)}
                  />
                ))}
              </ListGroup>
            ) : null}
          </View>
        ))}
        {ask.isPending ? (
          <Card>
            <AppText variant="callout" color="textSecondary">
              {t('bot.thinking')}
            </AppText>
          </Card>
        ) : null}
        {ask.error ? (
          <AppText variant="callout" color="danger">
            {t(ask.error.key as TranslationKey)}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}
