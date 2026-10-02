import { displayStatus, formatDateTime, formatTimeLeft, room, t, type Message, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useMe, useRoomMessages, useTaskDetail } from '@parri/shared/react';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUp, Paperclip, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BlurTargetProvider } from '@/components/glass/BlurTarget';
import { Button } from '@/components/glass/Button';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { FileList } from '@/components/task/FileList';
import { ReviewSheet, SubmitSheet, uploadPicked } from '@/components/task/Sheets';
import { BackButton } from '@/components/ui/BackButton';
import { Card, Center, EmptyState, StatusBadge } from '@/components/ui/bits';
import { pickFiles, type PickedFile } from '@/lib/files';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  const { colors, reduceTransparency } = useTheme();
  if (m.kind === 'system') {
    return (
      <View style={[styles.system, { backgroundColor: colors.separator }]}>
        <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
          {t(`event.${m.body}` as TranslationKey, { version: String((m.meta?.version as number | undefined) ?? '') })}
        </AppText>
      </View>
    );
  }
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
      {m.body ? (
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: colors.accent, borderBottomRightRadius: 6 }
              : { backgroundColor: reduceTransparency ? colors.cardSolid : colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderBottomLeftRadius: 6 },
          ]}
        >
          <AppText variant="body" color={mine ? 'onAccent' : 'text'}>
            {m.body}
          </AppText>
        </View>
      ) : null}
      {m.files.length > 0 && (
        <View style={{ maxWidth: '85%', width: '100%' }}>
          <FileList items={m.files} />
        </View>
      )}
      <AppText variant="caption" color="textSecondary" style={{ paddingHorizontal: 8 }}>
        {formatDateTime(m.created_at)}
      </AppText>
    </View>
  );
}

export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = useMe();
  const detail = useTaskDetail(id);
  const messages = useRoomMessages(id);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<PickedFile[]>([]);
  const [sheet, setSheet] = useState<null | 'submit' | 'review'>(null);
  const scroll = useRef<ScrollView>(null);

  const send = useApiMutation(
    async (sb, v: { body: string; files: PickedFile[] }) => room.send(sb, id!, v.body, await uploadPicked(sb, me.data!.profile.id, id!, 'chat', v.files)),
    {
      invalidate: () => [keys.messages(id!)],
      onSuccess: () => {
        setText('');
        setPending([]);
      },
    },
  );

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.data?.length]);

  const d = detail.data;
  const task = d?.task;
  const status = task ? displayStatus(task) : 'open';
  const active = ['in_progress', 'review', 'disputed'].includes(status);
  const latest = d?.submissions[0];

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetProvider>
        <MeshBackground />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: insets.top + 72, paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}>
            {detail.isLoading ? (
              <Center />
            ) : !d || !task || !(d.viewer_role === 'customer' || d.viewer_role === 'executor') || !task.executor_id ? (
              <EmptyState title={t('task.notFound')} />
            ) : (
              <>
                <Card>
                  <AppText variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }}>
                    {t('room.title')}
                  </AppText>
                  <AppText variant="title3">{task.title}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={status} />
                    {task.due_at && active && (
                      <AppText variant="callout" color="textSecondary">
                        {formatTimeLeft(task.due_at)}
                      </AppText>
                    )}
                  </View>
                  {d.viewer_role === 'executor' && status === 'in_progress' && <Button block label={t('task.submitWork')} onPress={() => setSheet('submit')} />}
                  {d.viewer_role === 'customer' && status === 'review' && latest && <Button block label={t('task.review')} onPress={() => setSheet('review')} />}
                </Card>
                {(messages.data ?? []).map((m) => (
                  <Bubble key={m.id} m={m} mine={m.sender_id === me.data?.profile.id} />
                ))}
              </>
            )}
          </ScrollView>
          <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {active ? (
              <GlassSurface radius={28} style={{ padding: 6, gap: 6 }}>
                {pending.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8, paddingTop: 4 }}>
                    {pending.map((f, i) => (
                      <Pressable key={i} onPress={() => setPending(pending.filter((_, j) => j !== i))} accessibilityLabel={`${t('common.remove')} ${f.name}`}>
                        <View style={[styles.fileChip, { backgroundColor: colors.separator }]}>
                          <AppText variant="caption">{f.name}</AppText>
                          <X size={12} color={colors.text} />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                  <Button
                    variant="glass"
                    size="icon"
                    accessibilityLabel={t('room.attach')}
                    icon={<Paperclip size={20} color={colors.text} />}
                    onPress={async () => setPending([...pending, ...(await pickFiles(10 - pending.length))].slice(0, 10))}
                  />
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={t('room.placeholder')}
                    accessibilityLabel={t('room.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    maxLength={4000}
                    style={{ flex: 1, minHeight: 48, maxHeight: 140, color: colors.text, fontSize: 17, fontFamily: familyByWeight['400'], paddingVertical: 12 }}
                  />
                  <Button
                    size="icon"
                    accessibilityLabel={t('common.send')}
                    icon={<ArrowUp size={20} strokeWidth={2.8} color={colors.onAccent} />}
                    disabled={send.isPending || (!text.trim() && !pending.length)}
                    onPress={() => send.mutate({ body: text.trim(), files: pending })}
                  />
                </View>
                {send.error && (
                  <AppText variant="callout" style={{ color: colors.danger, paddingHorizontal: 12 }}>
                    {t(send.error.key as TranslationKey)}
                  </AppText>
                )}
              </GlassSurface>
            ) : task ? (
              <GlassSurface radius={999} style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                <AppText variant="callout" color="textSecondary" style={{ textAlign: 'center' }}>
                  {t('room.readonly')}
                </AppText>
              </GlassSurface>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </BlurTargetProvider>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <BackButton />
      </View>
      {sheet === 'submit' && task && <SubmitSheet open onClose={() => setSheet(null)} task={task} />}
      {sheet === 'review' && task && latest && <ReviewSheet open onClose={() => setSheet(null)} task={task} submission={latest} />}
    </View>
  );
}

const styles = StyleSheet.create({
  system: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, maxWidth: '90%' },
  bubble: { maxWidth: '85%', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
  composerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  header: { position: 'absolute', top: 0, left: 16 },
});
