import {
  KB_ARTICLES,
  TICKET_CATEGORIES,
  formatAgo,
  support,
  t,
  type TicketCategory,
} from '@parri/shared';
import { useApiMutation, useMe, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { Paperclip, Scale } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Center, EmptyState, Label, PageTitle, Row, useToast } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow } from '@/components/ui/kit';
import { pickFiles, uploadPrivate, type PickedFile } from '@/lib/files';
import { useTheme } from '@/theme/ThemeProvider';

export default function Support() {
  const sb = useSupabase();
  const me = useMe();
  const toast = useToast();
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [category, setCategory] = useState<TicketCategory>('tasks');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => support.tickets(sb) });
  const create = useApiMutation(
    async (s) =>
      support.create(s, {
        category,
        subject,
        body,
        files: await uploadPrivate(s, me.data!.profile.id, 'support', files),
      }),
    {
      invalidate: () => [['tickets']],
      onSuccess: (tk) => {
        toast(t('support.sent'));
        setSubject('');
        setBody('');
        setFiles([]);
        router.push(`/support/${tk.id}`);
      },
    },
  );
  const needle = q.trim().toLowerCase();
  const articles = KB_ARTICLES.filter(
    (k) => !needle || `${t(`kb.${k}.q`)} ${t(`kb.${k}.a`)}`.toLowerCase().includes(needle),
  );
  const list = (tickets.data ?? []).filter(
    (x) =>
      filter === 'all' ||
      (filter === 'open'
        ? ['open', 'waiting'].includes(x.status)
        : ['resolved', 'closed'].includes(x.status)),
  );
  return (
    <Screen title={t('support.title')} leading={<BackButton />} onRefresh={() => tickets.refetch()}>
      <PageTitle>{t('support.title')}</PageTitle>
      <Card>
        <CardHeader title={t('support.kb')} />
        <TextField label={t('support.kbSearch')} value={q} onChangeText={setQ} />
        {articles.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ expanded: open === k }}
            onPress={() => setOpen(open === k ? null : k)}
            style={{ gap: 4, paddingVertical: 6 }}
          >
            <AppText variant="bodyStrong">{t(`kb.${k}.q`)}</AppText>
            {open === k ? (
              <AppText variant="callout" color="textSecondary">
                {t(`kb.${k}.a`)}
              </AppText>
            ) : null}
          </Pressable>
        ))}
      </Card>
      <Card>
        <CardHeader title={t('support.create')} />
        <Row>
          {TICKET_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(`support.categories.${c}`)}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </Row>
        <TextField
          label={t('support.subject')}
          value={subject}
          onChangeText={setSubject}
          maxLength={120}
        />
        <TextField
          label={t('support.body')}
          placeholder={t('support.bodyPlaceholder')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
        />
        {files.map((f, i) => (
          <AppText key={i} variant="callout">
            📎 {f.name}
          </AppText>
        ))}
        <Button
          variant="glass"
          icon={<Paperclip size={16} color={colors.text} />}
          label={t('support.attach')}
          onPress={async () => setFiles([...files, ...(await pickFiles(5))].slice(0, 5))}
        />
        <FormError error={create.error?.key} />
        <Button
          size="lg"
          block
          label={t('support.send')}
          disabled={subject.trim().length < 3 || body.trim().length < 10 || create.isPending}
          onPress={() => create.mutate(undefined)}
        />
      </Card>
      <Label>{t('support.mine')}</Label>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={(['all', 'open', 'resolved'] as const).map((v) => ({
          value: v,
          label: t(`support.filters.${v}`),
        }))}
      />
      {tickets.isLoading ? (
        <Center />
      ) : list.length === 0 ? (
        <EmptyState title={t('support.empty')} />
      ) : (
        <ListGroup>
          {list.map((x) => (
            <ListRow
              key={x.id}
              title={x.subject}
              subtitle={`${t(`support.categories.${x.category}`)} · ${formatAgo(x.updated_at)}`}
              value={t(`support.status.${x.status}`)}
              onPress={() => router.push(`/support/${x.id}`)}
            />
          ))}
        </ListGroup>
      )}
      <ListGroup>
        <ListRow
          icon={(c) => <Scale size={18} color={c} />}
          title={t('support.openDispute')}
          onPress={() => router.push('/disputes')}
        />
      </ListGroup>
      <View />
    </Screen>
  );
}
