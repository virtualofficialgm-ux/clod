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
import { Check, CircleCheck, Lock, Paperclip, Plus, X } from '@/components/icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { Checkbox } from '@/components/ui/Checkbox';
import { router } from 'expo-router';
import { FormError, TextField } from '@/components/ui/TextField';
import { Card, Label, Row, useToast } from '@/components/ui/bits';
import { fileBody, pickFiles, type PickedFile } from '@/lib/files';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

const invalidateTask = (id: string) => [
  keys.task(id),
  keys.messages(id),
  ['my-tasks'],
  keys.me,
  ['feed'],
];

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
        (text ?? null)
      )}
    </BottomSheet>
  );
}

const READY: ReadyWhen[] = ['now', 'in_1h', 'today', 'tomorrow'];

export function RespondSheet({
  open,
  onClose,
  task,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
  existing?: TaskResponse | null;
}) {
  const me = useMe();
  const toast = useToast();
  const { colors } = useTheme();
  const [cover, setCover] = useState(existing?.cover_letter ?? '');
  const [price, setPrice] = useState(String((existing?.price_cents ?? task.reward_cents) / 100));
  const [deadline, setDeadline] = useState<Deadline>(existing?.deadline ?? task.deadline);
  const [skills, setSkills] = useState<string[]>(existing?.skills ?? []);
  const [links, setLinks] = useState<string[]>(
    existing?.portfolio_links.length ? existing.portfolio_links : [''],
  );
  const [ready, setReady] = useState<ReadyWhen>(existing?.ready ?? 'now');
  const [video, setVideo] = useState(existing?.video_url ?? '');
  const [agree, setAgree] = useState(!!existing);
  const [sent, setSent] = useState<TaskResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!existing && existing.status === 'pending';
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task.currency });

  const m = useApiMutation(
    (sb, v: Parameters<typeof responses.submit>[2]) =>
      editing ? responses.update(sb, existing!.id, v) : responses.submit(sb, task.id, v),
    {
      invalidate: () => [keys.task(task.id), ['feed'], ['my-tasks']],
      onSuccess: (r) => {
        if (editing) {
          toast(t('respond.sent'));
          onClose();
        } else setSent(r);
      },
    },
  );

  if (sent) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('respond.sentTitle')}
        footer={
          <View style={{ gap: 10 }}>
            <Button
              size="lg"
              block
              label={t('respond.view')}
              onPress={() => {
                onClose();
                router.push(`/response/${sent.id}`);
              }}
            />
            <Button
              variant="glass"
              size="lg"
              block
              label={t('respond.findOther')}
              onPress={() => {
                onClose();
                router.push('/feed');
              }}
            />
          </View>
        }
      >
        <View testID="response-sent" style={{ alignItems: 'center', gap: 12 }}>
          <CircleCheck size={48} color={colors.success} />
          <AppText variant="callout" color="textSecondary" style={{ textAlign: 'center' }}>
            {t('respond.sentText')}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t('respond.responseId')}: {sent.id.slice(0, 8)}
          </AppText>
          <AppText variant="bodyStrong">
            {fmt(sent.price_cents)} · {t(`deadline.${sent.deadline}`)}
          </AppText>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('respond.title')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key} />
          {!editing && (
            <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {t('respond.noMoney')}
            </AppText>
          )}
          <Button
            size="lg"
            block
            label={editing ? t('respond.save') : t('respond.submit')}
            disabled={m.isPending || !agree}
            onPress={() => {
              const parsed = responseFormSchema.safeParse({
                coverLetter: cover,
                priceCents: parseDollars(price) ?? NaN,
                deadline,
                skills,
                portfolioLinks: links.map((l) => l.trim()).filter(Boolean),
                ready,
                videoUrl: video.trim(),
              });
              if (!parsed.success) return setErrors(fieldErrors(parsed.error));
              setErrors({});
              m.mutate(parsed.data);
            }}
          />
        </View>
      }
    >
      <TextField
        label={t('respond.cover')}
        placeholder={t('respond.coverPlaceholder')}
        value={cover}
        onChangeText={setCover}
        multiline
        maxLength={2000}
        counterMax={2000}
        error={errors.coverLetter}
      />
      <TextField
        label={t('respond.price')}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        hint={t('respond.priceHint', { v: fmt(task.reward_cents) })}
        error={errors.priceCents}
      />
      <View style={{ gap: 10 }}>
        <Label>{t('respond.deadline')}</Label>
        <Row>
          {DEADLINES.map((d) => (
            <Chip
              key={d}
              label={t(`deadline.${d}`)}
              selected={deadline === d}
              onPress={() => setDeadline(d)}
            />
          ))}
        </Row>
      </View>
      <View style={{ gap: 10 }}>
        <Label>{t('respond.ready')}</Label>
        <Row>
          {READY.map((r) => (
            <Chip
              key={r}
              label={t(`ready.${r}`)}
              selected={ready === r}
              onPress={() => setReady(r)}
            />
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
                onPress={() =>
                  setSkills((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))
                }
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
            <Button
              variant="glass"
              size="icon"
              accessibilityLabel={t('common.remove')}
              icon={<X size={18} color={colors.text} />}
              onPress={() => setLinks(links.filter((_, j) => j !== i))}
            />
          </View>
        ))}
        {links.length < 5 && (
          <Button
            variant="glass"
            label={t('respond.addLink')}
            icon={<Plus size={18} color={colors.text} />}
            onPress={() => setLinks([...links, ''])}
          />
        )}
      </View>
      <TextField
        label={t('respond.video')}
        hint={t('respond.videoHint')}
        value={video}
        onChangeText={setVideo}
        placeholder="https://"
        autoCapitalize="none"
        keyboardType="url"
        error={errors.videoUrl}
      />
      {!editing && (
        <Checkbox checked={agree} onChange={setAgree} label={t('respond.agree')} testID="agree" />
      )}
    </BottomSheet>
  );
}

function FilePicker({
  list,
  onChange,
}: {
  list: PickedFile[];
  onChange: (l: PickedFile[]) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {list.map((f, i) => (
        <Card key={i} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {f.name}
          </AppText>
          <Pressable
            accessibilityLabel={t('common.remove')}
            onPress={() => onChange(list.filter((_, j) => j !== i))}
            hitSlop={10}
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </Card>
      ))}
      {list.length < 10 && (
        <Button
          variant="glass"
          label={t('create.attach')}
          icon={<Paperclip size={18} color={colors.text} />}
          onPress={async () =>
            onChange([...list, ...(await pickFiles(10 - list.length))].slice(0, 10))
          }
        />
      )}
    </View>
  );
}

export async function uploadPicked(
  sb: Parameters<typeof filesApi.upload>[0],
  userId: string,
  taskId: string,
  area: 'brief' | 'chat' | 'submission',
  list: PickedFile[],
) {
  const refs: FileRef[] = [];
  for (const f of list) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const path = filesApi.path(userId, taskId, area, f.name, id);
    await filesApi.upload(sb, path, await fileBody(f), f.mime);
    refs.push({ path, name: f.name, size: f.size, mime: f.mime });
  }
  return refs;
}

const INCLUDED = ['matches_task', 'materials_attached', 'files_checked'] as const;

function CheckRow({
  checked,
  onPress,
  label,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.fill,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: checked ? colors.success : colors.textTertiary,
            backgroundColor: checked ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked && <Check size={16} strokeWidth={3} color="#fff" />}
        </View>
        <AppText variant="bodyStrong" style={{ flex: 1, fontFamily: familyByWeight['600'] }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

export function SubmitSheet({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
}) {
  const me = useMe();
  const toast = useToast();
  const [stage, setStage] = useState<'final' | 'intermediate'>('final');
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [included, setIncluded] = useState<string[]>([]);
  const [list, setList] = useState<PickedFile[]>([]);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useApiMutation(
    async (sb, v: { link: string; comment: string }) =>
      work.submit(sb, task.id, {
        ...v,
        stage,
        included,
        note,
        files: await uploadPicked(sb, me.data!.profile.id, task.id, 'submission', list),
      }),
    {
      invalidate: () => invalidateTask(task.id),
      onSuccess: () => {
        toast(t('submit.sent'));
        onClose();
      },
    },
  );
  const validate = () => {
    const parsed = submissionSchema.safeParse({
      link: link.trim(),
      comment,
      fileCount: list.length,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return null;
    }
    setErrors({});
    return parsed.data;
  };
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={preview ? t('submit.previewTitle') : t('submit.title')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key} />
          <Button
            size="lg"
            block
            label={t('submit.send')}
            disabled={m.isPending}
            onPress={() => {
              const v = validate();
              if (v) m.mutate({ link: v.link, comment: v.comment });
            }}
          />
          <Button
            variant="glass"
            block
            label={preview ? t('common.back') : t('submit.preview')}
            onPress={() => (preview ? setPreview(false) : validate() && setPreview(true))}
          />
        </View>
      }
    >
      {preview ? (
        <View testID="submit-preview" style={{ gap: 10 }}>
          <AppText variant="caption" color="accentText">
            {t(`submit.${stage}`)}
          </AppText>
          {comment ? <AppText variant="body">{comment}</AppText> : null}
          {link ? (
            <AppText variant="bodyStrong" color="accentText">
              {link}
            </AppText>
          ) : null}
          {list.map((f, i) => (
            <AppText key={i} variant="callout">
              {f.name}
            </AppText>
          ))}
          {included.map((x) => (
            <AppText key={x} variant="callout">
              ✓ {t(`submit.inc.${x as (typeof INCLUDED)[number]}`)}
            </AppText>
          ))}
          {note ? (
            <AppText variant="callout" color="textSecondary">
              {t('submit.note')}: {note}
            </AppText>
          ) : null}
        </View>
      ) : (
        <>
          <Label>{t('submit.stage')}</Label>
          <Segmented
            value={stage}
            onChange={setStage}
            options={[
              { value: 'final', label: t('submit.final') },
              { value: 'intermediate', label: t('submit.intermediate') },
            ]}
          />
          <TextField
            label={t('submit.description')}
            placeholder={t('submit.descriptionPlaceholder')}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={2000}
          />
          <TextField
            label={t('submit.link')}
            value={link}
            onChangeText={setLink}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
            error={errors.link}
          />
          <Label>{t('submit.files')}</Label>
          <FilePicker list={list} onChange={setList} />
          <Label>{t('submit.included')}</Label>
          {INCLUDED.map((x) => (
            <CheckRow
              key={x}
              checked={included.includes(x)}
              label={t(`submit.inc.${x}`)}
              onPress={() =>
                setIncluded((s) => (s.includes(x) ? s.filter((y) => y !== x) : [...s, x]))
              }
            />
          ))}
          <TextField
            label={t('submit.note')}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
          />
        </>
      )}
    </BottomSheet>
  );
}

const CRITERIA = ['structure', 'quality', 'formatting', 'completeness', 'deadline'] as const;
const DUE = { h1: 60, h3: 180, d1: 1440, d3: 4320 } as const;

export function ReviewSheet({
  open,
  onClose,
  task,
  submission,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
  submission: Submission;
}) {
  const toast = useToast();
  const me = useMe();
  const { colors } = useTheme();
  const pro = me.data?.profile.plan === 'pro';
  const [mode, setMode] = useState<'check' | 'revision'>('check');
  const [checked, setChecked] = useState<boolean[]>(task.checklist.map(() => false));
  const [criteria, setCriteria] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [marks, setMarks] = useState('');
  const [due, setDue] = useState<keyof typeof DUE>('d1');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task.currency });
  const m = useApiMutation(
    (sb, v: Parameters<typeof work.review>[2]) => work.review(sb, submission.id, v),
    {
      invalidate: () => invalidateTask(task.id),
      onSuccess: (_r, v) => {
        toast(
          t(
            v.decision === 'accept'
              ? 'review.accepted'
              : v.decision === 'revision'
                ? 'review.revisionSent'
                : 'review.disputeOpened',
          ),
        );
        onClose();
      },
    },
  );
  const decide = (decision: 'accept' | 'revision' | 'dispute') => {
    const full = [comment.trim(), marks.trim() ? `${t('review.marks')}: ${marks.trim()}` : '']
      .filter(Boolean)
      .join('\n');
    const parsed = reviewSchema.safeParse({ decision, checklist: checked, comment: full });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    m.mutate({
      ...parsed.data,
      ...(decision === 'revision'
        ? {
            revisionItems: checked.flatMap((c, i) => (c ? [] : [i])),
            revisionCriteria: criteria,
            revisionDue: new Date(Date.now() + DUE[due] * 60_000).toISOString(),
          }
        : {}),
    });
  };
  const list = task.checklist.map((item, i) => (
    <CheckRow
      key={i}
      checked={checked[i] ?? false}
      label={item}
      onPress={() => setChecked(checked.map((c, j) => (j === i ? !c : c)))}
    />
  ));

  if (mode === 'revision') {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('review.revisionTitle')}
        footer={
          <View style={{ gap: 10 }}>
            <FormError error={m.error?.key} />
            <Button
              size="lg"
              block
              label={t('review.sendRevision')}
              disabled={m.isPending}
              onPress={() => decide('revision')}
            />
            <Button
              variant="glass"
              block
              label={t('common.back')}
              onPress={() => setMode('check')}
            />
            <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {t('review.moneyStays')}
            </AppText>
          </View>
        }
      >
        {task.checklist.length > 0 && <Label>{t('review.notAccepted')}</Label>}
        {list}
        <Label>{t('review.criteriaTitle')}</Label>
        <Row>
          {CRITERIA.map((c) => (
            <Chip
              key={c}
              label={t(`review.criteria.${c}`)}
              selected={criteria.includes(c)}
              onPress={() =>
                setCriteria((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))
              }
            />
          ))}
        </Row>
        <TextField
          label={t('review.whatToFix')}
          placeholder={t('review.reasonPlaceholder')}
          hint={t('review.reasonHint')}
          value={comment}
          onChangeText={setComment}
          multiline
          error={errors.comment}
        />
        <TextField
          label={t('review.marks')}
          placeholder={t('review.marksPlaceholder')}
          value={marks}
          onChangeText={setMarks}
        />
        <Label>{t('review.newDue')}</Label>
        <Row>
          {(Object.keys(DUE) as (keyof typeof DUE)[]).map((k) => (
            <Chip
              key={k}
              label={t(`review.due.${k}`)}
              selected={due === k}
              onPress={() => setDue(k)}
            />
          ))}
        </Row>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('review.title')}
      footer={
        <View style={{ gap: 10 }}>
          <FormError error={m.error?.key ?? errors.checklist ?? errors.comment} />
          <Button
            size="lg"
            block
            label={`${t('review.accept')} · ${fmt(task.reward_cents)}`}
            disabled={m.isPending || !checked.every(Boolean)}
            onPress={() => decide('accept')}
          />
          <Button
            variant="glass"
            block
            label={t('review.revision')}
            disabled={m.isPending}
            onPress={() => setMode('revision')}
          />
          <Button
            variant="glass"
            block
            label={t('review.dispute')}
            icon={pro ? undefined : <Lock size={16} color={colors.textSecondary} />}
            disabled={m.isPending || !pro}
            onPress={() => decide('dispute')}
          />
          {!pro && (
            <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {t('room.disputePro')}
            </AppText>
          )}
        </View>
      }
    >
      {task.checklist.length > 0 && <Label>{t('review.checklistTitle')}</Label>}
      {list}
      <AppText variant="callout" color="textSecondary">
        {t('review.acceptHint', { v: fmt(task.reward_cents) })}
      </AppText>
      <AppText variant="callout" color="textSecondary">
        {t('review.noReject')}
      </AppText>
      {pro && (
        <TextField
          label={t('review.reason')}
          placeholder={t('review.reasonPlaceholder')}
          hint={t('review.reasonHint')}
          value={comment}
          onChangeText={setComment}
          multiline
          error={errors.comment}
        />
      )}
    </BottomSheet>
  );
}

export { FilePicker };
