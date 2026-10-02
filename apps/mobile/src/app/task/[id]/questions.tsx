import { formatDateTime, t, taskExtras, type TaskQuestion } from '@parri/shared';
import { keys, useApiMutation, useMe, useTaskDetail, useTaskQuestions } from '@parri/shared/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Trash2 } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Avatar, Center, EmptyState } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

function Message({ q, mine, onDelete }: { q: TaskQuestion; mine: boolean; onDelete: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Avatar name={q.author_name} url={q.author_avatar} size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="callout">
          <AppText variant="bodyStrong">{q.author_name}</AppText>
          {q.is_customer ? ` · ${t('questions.customer')}` : ''} · {formatDateTime(q.created_at)}
        </AppText>
        <AppText variant="body" color={q.deleted ? 'textSecondary' : 'text'}>
          {q.deleted ? t('questions.deleted') : q.body}
        </AppText>
      </View>
      {mine && !q.deleted && (
        <Button
          variant="glass"
          size="icon"
          accessibilityLabel={t('questions.delete')}
          icon={<Trash2 size={16} color={colors.text} />}
          onPress={onDelete}
        />
      )}
    </View>
  );
}

function Composer({
  taskId,
  parentId,
  label,
  placeholder,
  onDone,
}: {
  taskId: string;
  parentId?: string;
  label: string;
  placeholder: string;
  onDone?: () => void;
}) {
  const [body, setBody] = useState('');
  const send = useApiMutation((sb) => taskExtras.ask(sb, taskId, body, parentId), {
    invalidate: () => [keys.questions(taskId), keys.task(taskId)],
    onSuccess: () => {
      setBody('');
      onDone?.();
    },
  });
  return (
    <View style={{ gap: 8 }}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={1000}
      />
      <FormError error={send.error?.key} />
      <Button
        label={t('questions.publish')}
        disabled={body.trim().length < 2 || send.isPending}
        onPress={() => send.mutate(undefined)}
      />
    </View>
  );
}

export default function QuestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const d = useTaskDetail(id).data;
  const { data, isLoading, refetch } = useTaskQuestions(id);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const del = useApiMutation((sb, qid: string) => taskExtras.deleteQuestion(sb, qid), {
    invalidate: () => [keys.questions(id!), keys.task(id!)],
  });
  const uid = me.data?.profile.id;
  const roots = (data ?? []).filter((q) => !q.parent_id);
  const replies = (pid: string) => (data ?? []).filter((q) => q.parent_id === pid);
  const isCustomer = d?.viewer_role === 'customer';
  return (
    <Screen title={t('questions.title')} leading={<BackButton />} onRefresh={() => refetch()}>
      {d ? (
        <AppText variant="callout" color="textSecondary">
          {d.task.title}
        </AppText>
      ) : null}
      {!isCustomer && (
        <Card>
          <Composer
            taskId={id!}
            label={t('questions.ask')}
            placeholder={t('questions.askPlaceholder')}
          />
        </Card>
      )}
      {isLoading ? (
        <Center />
      ) : roots.length === 0 ? (
        <EmptyState title={t('questions.empty')} />
      ) : (
        roots.map((q) => (
          <Card key={q.id} testID="question">
            <Message q={q} mine={q.author_id === uid} onDelete={() => del.mutate(q.id)} />
            {replies(q.id).map((r) => (
              <View key={r.id} style={{ marginLeft: 20 }}>
                <Message q={r} mine={r.author_id === uid} onDelete={() => del.mutate(r.id)} />
              </View>
            ))}
            {(isCustomer || q.author_id === uid) && !q.deleted ? (
              replyTo === q.id ? (
                <View style={{ gap: 8 }}>
                  <Composer
                    taskId={id!}
                    parentId={q.id}
                    label={t('questions.answer')}
                    placeholder={t('questions.answerPlaceholder')}
                    onDone={() => setReplyTo(null)}
                  />
                  <Button
                    variant="glass"
                    label={t('questions.cancelAnswer')}
                    onPress={() => setReplyTo(null)}
                  />
                </View>
              ) : (
                <Button
                  variant="glass"
                  label={t('questions.answer')}
                  onPress={() => setReplyTo(q.id)}
                />
              )
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
