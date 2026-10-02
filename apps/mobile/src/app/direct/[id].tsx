import { direct, formatAgo, formatDateTime, isOnline, t, type TranslationKey } from '@parri/shared';
import {
  keys,
  useApiMutation,
  useDirect,
  useMe,
  usePeerState,
  usePublicProfile,
  useSupabase,
  useTypingPing,
} from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BlurTargetProvider } from '@/components/glass/BlurTarget';
import { Button } from '@/components/glass/Button';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { ArrowUp, CheckCheck } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Avatar, Center, EmptyState } from '@/components/ui/bits';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export default function DirectChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, reduceTransparency } = useTheme();
  const sb = useSupabase();
  const qc = useQueryClient();
  const me = useMe();
  const peer = usePublicProfile(id);
  const msgs = useDirect(id);
  const where = useMemo(() => ({ peerId: id }), [id]);
  const state = usePeerState(where);
  const ping = useTypingPing(where);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollView>(null);
  const count = msgs.data?.length ?? 0;
  const uid = me.data?.profile.id;

  useEffect(() => {
    if (!count || !id) return;
    direct
      .markRead(sb, id)
      .then(() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: keys.directThreads }),
          qc.invalidateQueries({ queryKey: ['notifications'] }),
        ]),
      )
      .catch(() => undefined);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [count, sb, id, qc]);

  const send = useApiMutation((s, body: string) => direct.send(s, id!, body), {
    invalidate: () => [keys.direct(id!), keys.directThreads],
    onSuccess: () => setText(''),
  });

  const p = peer.data;
  const online = isOnline(state?.last_seen_at ?? p?.last_seen_at);
  const status = state?.typing
    ? t('direct.typing')
    : online
      ? t('profile.online')
      : p?.last_seen_at
        ? t('profile.lastSeen', { ago: formatAgo(p.last_seen_at) })
        : '';
  const lastMine = [...(msgs.data ?? [])].reverse().find((m) => m.sender_id === uid);
  const canWrite =
    !!p && (p.relation.can_message || (msgs.data ?? []).some((m) => m.sender_id === p.id));

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetProvider>
        <MeshBackground />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scroll}
            contentContainerStyle={{
              paddingTop: insets.top + 72,
              paddingHorizontal: 16,
              paddingBottom: 120,
              gap: 10,
            }}
          >
            {peer.isLoading ? (
              <Center />
            ) : !p || p.private ? (
              <EmptyState title={t('profile.notFound')} />
            ) : (
              <>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push(`/u/${p.username ?? p.id}`)}
                  style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 }}
                >
                  <Avatar name={p.name} url={p.avatar_url} size={44} />
                  <View>
                    <AppText variant="bodyStrong">{p.name}</AppText>
                    <AppText
                      variant="caption"
                      color={state?.typing || online ? 'success' : 'textSecondary'}
                      testID="peer-status"
                    >
                      {status}
                    </AppText>
                  </View>
                </Pressable>
                {(msgs.data ?? []).map((m) => {
                  const mine = m.sender_id === uid;
                  return (
                    <View
                      key={m.id}
                      style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}
                    >
                      <View
                        style={[
                          styles.bubble,
                          mine
                            ? { backgroundColor: colors.accent, borderBottomRightRadius: 6 }
                            : {
                                backgroundColor: reduceTransparency
                                  ? colors.cardSolid
                                  : colors.card,
                                borderColor: colors.cardBorder,
                                borderWidth: 1,
                                borderBottomLeftRadius: 6,
                              },
                        ]}
                      >
                        <AppText variant="body" color={mine ? 'onAccent' : 'text'}>
                          {m.body}
                        </AppText>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                        }}
                      >
                        <AppText variant="caption" color="textSecondary">
                          {formatDateTime(m.created_at)}
                        </AppText>
                        {mine && m.id === lastMine?.id ? (
                          <>
                            <CheckCheck
                              size={13}
                              color={m.read_at ? colors.accentText : colors.textSecondary}
                            />
                            <AppText
                              variant="caption"
                              color={m.read_at ? 'accentText' : 'textSecondary'}
                            >
                              {m.read_at ? t('room.read') : t('room.delivered')}
                            </AppText>
                          </>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {p && canWrite ? (
              <GlassSurface
                radius={28}
                style={{ padding: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}
              >
                <TextInput
                  value={text}
                  onChangeText={(v) => {
                    setText(v);
                    ping();
                  }}
                  placeholder={t('direct.placeholder')}
                  accessibilityLabel={t('direct.placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={4000}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    maxHeight: 140,
                    color: colors.text,
                    fontSize: 17,
                    fontFamily: familyByWeight['400'],
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                  }}
                />
                <Button
                  size="icon"
                  accessibilityLabel={t('common.send')}
                  icon={<ArrowUp size={20} strokeWidth={2.8} color={colors.onAccent} />}
                  disabled={send.isPending || !text.trim()}
                  onPress={() => send.mutate(text.trim())}
                />
              </GlassSurface>
            ) : p ? (
              <GlassSurface radius={999} style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                <AppText variant="callout" color="textSecondary" style={{ textAlign: 'center' }}>
                  {t('direct.forbidden')}
                </AppText>
              </GlassSurface>
            ) : null}
            {send.error ? (
              <AppText variant="callout" color="danger" style={{ textAlign: 'center' }}>
                {t(send.error.key as TranslationKey)}
              </AppText>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </BlurTargetProvider>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <BackButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
  composer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  header: { position: 'absolute', top: 0, left: 16 },
});
