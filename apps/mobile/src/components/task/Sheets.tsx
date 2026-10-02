import {
  DEADLINES,
  fieldErrors,
  files as filesApi,
  formatMoney,
  parseDollars,
  responseFormSchema,
  responses,
  reviewSchema,
  submissionSchema,
  t,
  work,
  type Deadline,
  type FileRef,
  type ReadyWhen,
  type Submission,
  type Task,
  type TaskResponse,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMe } from '@parri/shared/react';
import { Check, Paperclip, Plus, X } from '@/components/icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { FormError, TextField } from '@/components/ui/TextField';
import { Card, Label, Row, useToast } from '@/components/ui/bits';
import { fileBody, pickFiles, type PickedFile } from '@/lib/files';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

const invalidateTask = (id: string) => [keys.task(id), keys.messages(id), ['my-tasks'], keys.me, ['feed']];

export function ConfirmSheet({
  open,
  onClose,
  title,
  text,
  confirmLabel,
  onConfirm,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={error} />
          <Button size="lg" block label={confirmLabel} disabled={busy} onPress={onConfirm} />
        </View>
      }
    >
      {typeof text === 'string' ? (
        <AppText variant="body" color="textSecondary">
          {text}
        </AppText>
      ) : (
        text ?? null
      )}
    </BottomSheet>
  );
}

const READY: ReadyWhen[] = ['now', 'in_1h', 'today', 'tomorrow'];

export function RespondSheet({ open, onClose, task, existing }: { open: boolean; onClose: () => void; task: Task; existing?: TaskResponse | null }) {
  const me = useMe();
  const toast = useToast();
  const { colors } = useTheme();
  const [cover, setCover] = useState(existing?.cover_letter ?? '');
  const [price, setPrice] = useState(String((existing?.price_cents ?? task.reward_cents) / 100));
  const [deadline, setDeadline] = useState<Deadline>(existing?.deadline ?? task.deadline);
  const [skills, setSkills] = useState<string[]>(existing?.skills ?? []);
  const [links, setLinks] = useState<string[]>(existing?.portfolio_links.length ? existing.portfolio_links : ['']);
  const [ready, setReady] = useState<ReadyWhen>(existing?.ready ?? 'now');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!existing && existing.status === 'pending';

  const m = useApiMutation((sb, v: Parameters<typeof responses.submit>[2]) => (editing ? responses.update(sb, existing!.id, v) : responses.submit(sb, task.id, v)), {
    invalidate: () => [keys.task(task.id), ['feed'], ['my-tasks']],
    onSuccess: () => {
      toast(t('respond.sent'));
      onClose();
    },
  });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('respond.title')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key} />
          <Button
            size="lg"
            block
            label={editing ? t('respond.save') : t('respond.submit')}
            disabled={m.isPending}
            onPress={() => {
              const parsed = responseFormSchema.safeParse({
                coverLetter: cover,
                priceCents: parseDollars(price) ?? NaN,
                deadline,
                skills,
                portfolioLinks: links.map((l) => l.trim()).filter(Boolean),
                ready,
              });
              if (!parsed.success) return setErrors(fieldErrors(parsed.error));
              setErrors({});
              m.mutate(parsed.data);
            }}
          />
        </View>
      }
    >
      <TextField label={t('respond.cover')} placeholder={t('respond.coverPlaceholder')} value={cover} onChangeText={setCover} multiline maxLength={2000} counterMax={2000} error={errors.coverLetter} />
      <TextField label={t('respond.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" hint={t('respond.priceHint', { v: formatMoney(task.reward_cents) })} error={errors.priceCents} />
      <View style={{ gap: 10 }}>
        <Label>{t('respond.deadline')}</Label>
        <Row>
          {DEADLINES.map((d) => (
            <Chip key={d} label={t(`deadline.${d}`)} selected={deadline === d} onPress={() => setDeadline(d)} />
          ))}
        </Row>
      </View>
      <View style={{ gap: 10 }}>
        <Label>{t('respond.ready')}</Label>
        <Row>
          {READY.map((r) => (
            <Chip key={r} label={t(`ready.${r}`)} selected={ready === r} onPress={() => setReady(r)} />
          ))}
        </Row>
      </View>
      {!!me.data?.skills.length && (
        <View style={{ gap: 10 }}>
          <Label>{t('respond.skills')}</Label>
          <Row>
            {me.data.skills.map((s) => (
              <Chip
                key={s}
                label={t(`skill.${s}` as TranslationKey)}
                selected={skills.includes(s)}
                onPress={() => setSkills((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
              />
            ))}
          </Row>
        </View>
      )}
      <View style={{ gap: 10 }}>
        <Label>{t('respond.links')}</Label>
        {links.map((l, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={`${i + 1}.`}
                value={l}
                onChangeText={(v) => setLinks(links.map((x, j) => (j === i ? v : x)))}
                placeholder="https://"
                autoCapitalize="none"
                keyboardType="url"
                error={errors[`portfolioLinks.${i}`]}
              />
            </View>
            <Button variant="glass" size="icon" accessibilityLabel={t('common.remove')} icon={<X size={18} color={colors.text} />} onPress={() => setLinks(links.filter((_, j) => j !== i))} />
          </View>
        ))}
        {links.length < 5 && <Button variant="glass" label={t('respond.addLink')} icon={<Plus size={18} color={colors.text} />} onPress={() => setLinks([...links, ''])} />}
      </View>
    </BottomSheet>
  );
}

function FilePicker({ list, onChange }: { list: PickedFile[]; onChange: (l: PickedFile[]) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {list.map((f, i) => (
        <Card key={i} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {f.name}
          </AppText>
          <Pressable accessibilityLabel={t('common.remove')} onPress={() => onChange(list.filter((_, j) => j !== i))} hitSlop={10}>
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </Card>
      ))}
      {list.length < 10 && (
        <Button
          variant="glass"
          label={t('create.attach')}
          icon={<Paperclip size={18} color={colors.text} />}
          onPress={async () => onChange([...list, ...(await pickFiles(10 - list.length))].slice(0, 10))}
        />
      )}
    </View>
  );
}

export async function uploadPicked(sb: Parameters<typeof filesApi.upload>[0], userId: string, taskId: string, area: 'brief' | 'chat' | 'submission', list: PickedFile[]) {
  const refs: FileRef[] = [];
  for (const f of list) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const path = filesApi.path(userId, taskId, area, f.name, id);
    await filesApi.upload(sb, path, await fileBody(f), f.mime);
    refs.push({ path, name: f.name, size: f.size, mime: f.mime });
  }
  return refs;
}

export function SubmitSheet({ open, onClose, task }: { open: boolean; onClose: () => void; task: Task }) {
  const me = useMe();
  const toast = useToast();
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [list, setList] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useApiMutation(
    async (sb, v: { link: string; comment: string }) =>
      work.submit(sb, task.id, { ...v, files: await uploadPicked(sb, me.data!.profile.id, task.id, 'submission', list) }),
    {
      invalidate: () => invalidateTask(task.id),
      onSuccess: () => {
        toast(t('submit.sent'));
        onClose();
      },
    },
  );
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('submit.title')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key} />
          <Button
            size="lg"
            block
            label={t('submit.send')}
            disabled={m.isPending}
            onPress={() => {
              const parsed = submissionSchema.safeParse({ link: link.trim(), comment, fileCount: list.length });
              if (!parsed.success) return setErrors(fieldErrors(parsed.error));
              setErrors({});
              m.mutate({ link: parsed.data.link, comment: parsed.data.comment });
            }}
          />
        </View>
      }
    >
      <TextField label={t('submit.link')} value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" keyboardType="url" error={errors.link} />
      <TextField label={t('submit.comment')} value={comment} onChangeText={setComment} multiline maxLength={2000} />
      <Label>{t('submit.files')}</Label>
      <FilePicker list={list} onChange={setList} />
    </BottomSheet>
  );
}

export function ReviewSheet({ open, onClose, task, submission }: { open: boolean; onClose: () => void; task: Task; submission: Submission }) {
  const toast = useToast();
  const { colors } = useTheme();
  const [checked, setChecked] = useState<boolean[]>(task.checklist.map(() => false));
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useApiMutation((sb, v: { decision: 'accept' | 'revision' | 'dispute'; checklist: boolean[]; comment: string }) => work.review(sb, submission.id, v), {
    invalidate: () => invalidateTask(task.id),
    onSuccess: (_r, v) => {
      toast(t(v.decision === 'accept' ? 'review.accepted' : v.decision === 'revision' ? 'review.revisionSent' : 'review.disputeOpened'));
      onClose();
    },
  });
  const decide = (decision: 'accept' | 'revision' | 'dispute') => {
    const parsed = reviewSchema.safeParse({ decision, checklist: checked, comment });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    m.mutate(parsed.data);
  };
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('review.title')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key ?? errors.checklist} />
          <Button size="lg" block label={t('review.accept')} disabled={m.isPending || !checked.every(Boolean)} onPress={() => decide('accept')} />
          <Button variant="glass" block label={t('review.revision')} disabled={m.isPending} onPress={() => decide('revision')} />
          <Button variant="glass" block label={t('review.dispute')} disabled={m.isPending} onPress={() => decide('dispute')} />
        </View>
      }
    >
      {task.checklist.length > 0 && <Label>{t('review.checklistTitle')}</Label>}
      {task.checklist.map((item, i) => (
        <Pressable
          key={i}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: checked[i] }}
          accessibilityLabel={item}
          onPress={() => setChecked(checked.map((c, j) => (j === i ? !c : c)))}
        >
          <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: checked[i] ? colors.success : colors.textTertiary,
                backgroundColor: checked[i] ? colors.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {checked[i] && <Check size={16} strokeWidth={3} color="#fff" />}
            </View>
            <AppText variant="bodyStrong" style={{ flex: 1, fontFamily: familyByWeight['600'] }}>
              {item}
            </AppText>
          </Card>
        </Pressable>
      ))}
      <AppText variant="callout" color="textSecondary">
        {t('review.acceptHint', { v: formatMoney(task.reward_cents) })}
      </AppText>
      <TextField
        label={t('review.reason')}
        placeholder={t('review.reasonPlaceholder')}
        hint={t('review.reasonHint')}
        value={comment}
        onChangeText={setComment}
        multiline
        error={errors.comment}
      />
    </BottomSheet>
  );
}

export { FilePicker };
