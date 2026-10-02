import {
  displayStatus,
  formatDateTime,
  formatMoney,
  formatTimeLeft,
  room,
  t,
  work,
  type Message,
  type TaskDetail,
  type TranslationKey,
} from '@parri/shared';
import { chats } from '@parri/shared';
import {
  keys,
  useApiMutation,
  useMe,
  usePeerState,
  useRoomMessages,
  useSupabase,
  useTaskDetail,
  useTypingPing,
} from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowUp,
  CheckCheck,
  ChevronRight,
  Clock,
  Coins,
  Map,
  Paperclip,
  X,
} from '@/components/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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
import { FileList } from '@/components/task/FileList';
import { ExtensionSheet, TipSheet } from '@/components/task/MoreSheets';
import { ReviewSheet, SubmitSheet, uploadPicked } from '@/components/task/Sheets';
import { ListGroup, ListRow } from '@/components/ui/kit';
import { useToast } from '@/components/ui/bits';
import { BackButton } from '@/components/ui/BackButton';
import { Card, Center, EmptyState, StatusBadge } from '@/components/ui/bits';
import { pickFiles, type PickedFile } from '@/lib/files';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

function Bubble({ m, mine, read }: { m: Message; mine: boolean; read?: boolean }) {
  const { colors, reduceTransparency } = useTheme();
  if (m.kind === 'system') {
    return (
      <View style={[styles.system, { backgroundColor: colors.fill }]}>
        <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
          {t(`event.${m.body}` as TranslationKey, {
            version: String((m.meta?.version as number | undefined) ?? ''),
          })}
          {typeof m.meta?.amount_cents === 'number'
            ? ` · ${formatMoney(m.meta.amount_cents as number, 'ru-RU', { currency: (m.meta.currency as 'USD' | 'USDT') ?? 'USD' })}`
            : ''}
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
              : {
                  backgroundColor: reduceTransparency ? colors.cardSolid : colors.card,
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
      ) : null}
      {m.files.length > 0 && (
        <View style={{ maxWidth: '85%', width: '100%' }}>
          <FileList items={m.files} />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 }}>
        <AppText variant="caption" color="textSecondary">
          {formatDateTime(m.created_at)}
        </AppText>
        {mine ? (
          <>
            <CheckCheck size={13} color={read ? colors.accentText : colors.textSecondary} />
            <AppText variant="caption" color={read ? 'accentText' : 'textSecondary'}>
              {read ? t('room.read') : t('room.delivered')}
            </AppText>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Сводка задания в комнате: награда, резерв, срок, что сдать, продление, чаевые, версии */
function InfoCard({
  d,
  onExtension,
  onTip,
}: {
  d: TaskDetail;
  onExtension: () => void;
  onTip: () => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const task = d.task;
  const status = displayStatus(task);
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task.currency });
  const executor = d.viewer_role === 'executor';
  const ext = d.extension;
  const decide = useApiMutation(
    (sb, accept: boolean) => work.decideExtension(sb, ext!.id, accept),
    {
      invalidate: () => [keys.task(task.id), keys.messages(task.id)],
      onSuccess: (_r, accept) =>
        toast(accept ? t('event.extension_accepted') : t('event.extension_declined')),
    },
  );
  return (
    <>
      {ext?.status === 'pending' ? (
        <Card testID="extension-pending">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Clock size={18} color={colors.text} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {t('room.extensionPending', {
                m: t(`room.minutes.${ext.minutes}` as TranslationKey),
              })}
            </AppText>
          </View>
          {ext.reason ? (
            <AppText variant="callout" color="textSecondary">
              {ext.reason}
            </AppText>
          ) : null}
          {!executor && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label={t('room.extensionAccept')}
                disabled={decide.isPending}
                onPress={() => decide.mutate(true)}
              />
              <Button
                variant="glass"
                label={t('room.extensionDecline')}
                disabled={decide.isPending}
                onPress={() => decide.mutate(false)}
              />
            </View>
          )}
        </Card>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
          }}
        >
          <AppText variant="bodyStrong">{t('room.info')}</AppText>
          <ChevronRight
            size={18}
            color={colors.textSecondary}
            style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
          />
        </View>
      </Pressable>
      {open ? (
        <Card>
          <ListGroup>
            <ListRow title={t('task.reward')} value={fmt(task.reward_cents)} />
            <ListRow title={t('room.reserved')} value={fmt(task.reward_cents)} />
            {task.due_at ? (
              <ListRow title={t('room.deadline')} subtitle={formatDateTime(task.due_at)} />
            ) : null}
            <ListRow
              title={t('task.resultFormat')}
              value={t(`format.${task.result_format}` as TranslationKey)}
            />
          </ListGroup>
          {task.checklist.length > 0 && (
            <View style={{ gap: 4 }}>
              <AppText variant="bodyStrong">{t('room.whatToSubmit')}</AppText>
              {task.checklist.map((c, i) => (
                <AppText key={i} variant="callout">
                  • {c}
                </AppText>
              ))}
            </View>
          )}
          {d.attachments.length > 0 && <FileList items={d.attachments} />}
          {task.kind === 'nearby' && task.lat != null && task.lng != null && (
            <Button
              variant="glass"
              icon={<Map size={16} color={colors.text} />}
              label={t('room.openMaps')}
              onPress={() =>
                Linking.openURL(
                  Platform.OS === 'ios'
                    ? `http://maps.apple.com/?ll=${task.lat},${task.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${task.lat},${task.lng}`,
                )
              }
            />
          )}
          <Button
            variant="glass"
            label={t('room.openTask')}
            onPress={() => router.push(`/task/${task.id}`)}
          />
          {d.submissions.map((s) => (
            <View
              key={s.id}
              style={{ gap: 2, backgroundColor: colors.fill, borderRadius: 14, padding: 12 }}
            >
              <AppText variant="bodyStrong">
                {t('task.version', { n: s.version })} ·{' '}
                {t(`submissionStatus.${s.status}` as TranslationKey)}
              </AppText>
              {s.comment ? <AppText variant="callout">{s.comment}</AppText> : null}
              {s.link ? (
                <AppText
                  variant="callout"
                  color="accentText"
                  numberOfLines={1}
                  onPress={() => s.link && Linking.openURL(s.link)}
                >
                  {s.link}
                </AppText>
              ) : null}
              {s.review_comment ? (
                <AppText variant="callout" color="warning">
                  {s.review_comment}
                  {s.revision_due
                    ? ` · ${t('room.revisionDue', { date: formatDateTime(s.revision_due) })}`
                    : ''}
                </AppText>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {executor && ['in_progress', 'review'].includes(status) && ext?.status !== 'pending' && (
          <Button
            variant="glass"
            icon={<Clock size={16} color={colors.text} />}
            label={t('room.extension')}
            onPress={onExtension}
          />
        )}
        {!executor && ['in_progress', 'review', 'completed'].includes(status) && (
          <Button
            variant="glass"
            icon={<Coins size={16} color={colors.text} />}
            label={t('room.tip')}
            onPress={onTip}
          />
        )}
      </View>
    </>
  );
}

export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = useMe();
  const detail = useTaskDetail(id);
  const messages = useRoomMessages(id);
  const sb = useSupabase();
  const qc = useQueryClient();
  const participant =
    detail.data?.viewer_role === 'customer' || detail.data?.viewer_role === 'executor';
  const count = messages.data?.length ?? 0;
  // Открытый чат = прочитанный: обновляем отметку при каждом новом сообщении
  useEffect(() => {
    if (!participant || !detail.data?.task.executor_id) return;
    chats
      .markRead(sb, id)
      .then(() => qc.invalidateQueries({ queryKey: keys.chats }))
      .catch(() => {});
  }, [participant, detail.data?.task.executor_id, count, sb, id, qc]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<PickedFile[]>([]);
  const [sheet, setSheet] = useState<null | 'submit' | 'review' | 'extension' | 'tip'>(null);
  const where = useMemo(() => ({ taskId: id }), [id]);
  const peer = usePeerState(where, participant);
  const readAt = peer?.read_at;
  const ping = useTypingPing(where);
  const scroll = useRef<ScrollView>(null);

  const send = useApiMutation(
    async (sb, v: { body: string; files: PickedFile[] }) =>
      room.send(sb, id!, v.body, await uploadPicked(sb, me.data!.profile.id, id!, 'chat', v.files)),
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
              gap: 12,
            }}
          >
            {detail.isLoading ? (
              <Center />
            ) : !d ||
              !task ||
              !(d.viewer_role === 'customer' || d.viewer_role === 'executor') ||
              !task.executor_id ? (
              <EmptyState title={t('task.notFound')} />
            ) : (
              <>
                <Card>
                  <AppText
                    variant="caption"
                    color="textSecondary"
                    style={{ textTransform: 'uppercase' }}
                  >
                    {t('room.title')}
                  </AppText>
                  <AppText variant="title3">{task.title}</AppText>
                  {peer?.typing ? (
                    <AppText variant="callout" color="success" testID="typing">
                      {(d.viewer_role === 'customer'
                        ? d.executor?.first_name
                        : d.customer.first_name) ?? ''}{' '}
                      {t('direct.typing')}
                    </AppText>
                  ) : null}
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                  >
                    <StatusBadge status={status} />
                    {task.due_at && active && (
                      <AppText variant="callout" color="textSecondary">
                        {formatTimeLeft(task.due_at)}
                      </AppText>
                    )}
                  </View>
                  {d.viewer_role === 'executor' && status === 'in_progress' && (
                    <Button block label={t('task.submitWork')} onPress={() => setSheet('submit')} />
                  )}
                  {d.viewer_role === 'customer' && status === 'review' && latest && (
                    <Button block label={t('task.review')} onPress={() => setSheet('review')} />
                  )}
                </Card>
                <InfoCard
                  d={d}
                  onExtension={() => setSheet('extension')}
                  onTip={() => setSheet('tip')}
                />
                {(messages.data ?? []).map((m) => (
                  <Bubble
                    key={m.id}
                    m={m}
                    mine={m.sender_id === me.data?.profile.id}
                    read={!!readAt && new Date(readAt) >= new Date(m.created_at)}
                  />
                ))}
              </>
            )}
          </ScrollView>
          <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {active ? (
              <GlassSurface radius={28} style={{ padding: 6, gap: 6 }}>
                {pending.length > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                      paddingHorizontal: 8,
                      paddingTop: 4,
                    }}
                  >
                    {pending.map((f, i) => (
                      <Pressable
                        key={i}
                        onPress={() => setPending(pending.filter((_, j) => j !== i))}
                        accessibilityLabel={`${t('common.remove')} ${f.name}`}
                      >
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
                    onPress={async () =>
                      setPending(
                        [...pending, ...(await pickFiles(10 - pending.length))].slice(0, 10),
                      )
                    }
                  />
                  <TextInput
                    value={text}
                    onChangeText={(v) => {
                      setText(v);
                      ping();
                    }}
                    placeholder={t('room.placeholder')}
                    accessibilityLabel={t('room.placeholder')}
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
                    }}
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
                  <AppText
                    variant="callout"
                    style={{ color: colors.danger, paddingHorizontal: 12 }}
                  >
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
      {sheet === 'submit' && task && (
        <SubmitSheet open onClose={() => setSheet(null)} task={task} />
      )}
      {sheet === 'review' && task && latest && (
        <ReviewSheet open onClose={() => setSheet(null)} task={task} submission={latest} />
      )}
      {sheet === 'extension' && task && (
        <ExtensionSheet taskId={task.id} onClose={() => setSheet(null)} />
      )}
      {sheet === 'tip' && d && <TipSheet d={d} onClose={() => setSheet(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  system: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '90%',
  },
  bubble: { maxWidth: '85%', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
  composerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  header: { position: 'absolute', top: 0, left: 16 },
});
