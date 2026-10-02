'use client';

import {
  DEADLINES,
  fieldErrors,
  formatMoney,
  parseDollars,
  responseFormSchema,
  responses,
  t,
  type Deadline,
  type ReadyWhen,
  type Task,
  type TaskResponse,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMe } from '@parri/shared/react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Checkbox, FormError, Input, TextArea } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { useToast } from '@/components/ui/Toast';

const READY: ReadyWhen[] = ['now', 'in_1h', 'today', 'tomorrow'];

/** Форма отклика: письмо от 20 символов, своя цена и срок, навыки, портфолио, когда готов начать */
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

  const mutation = useApiMutation(
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

  const submit = () => {
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
    mutation.mutate(parsed.data);
  };

  if (sent) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('respond.sentTitle')}
        footer={
          <div className="flex flex-col gap-2">
            <LinkButton href={`/responses/${sent.id}`} size="lg">
              {t('respond.view')}
            </LinkButton>
            <LinkButton href="/feed" variant="glass" size="lg">
              {t('respond.findOther')}
            </LinkButton>
          </div>
        }
      >
        <div
          className="flex flex-col items-center gap-3 py-4 text-center"
          data-testid="response-sent"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 size={32} />
          </span>
          <p className="text-callout text-text-2">{t('respond.sentText')}</p>
          <div className="tile w-full px-4 py-3 text-left">
            <p className="text-caption text-text-2">{t('respond.responseId')}</p>
            <p className="font-mono font-semibold">{sent.id.slice(0, 8)}</p>
          </div>
          <p className="font-semibold">
            {formatMoney(sent.price_cents, 'ru-RU', { currency: task.currency })} ·{' '}
            {t(`deadline.${sent.deadline}`)}
          </p>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('respond.title')}
      footer={
        <div className="flex flex-col gap-3">
          <FormError error={mutation.error?.key} />
          {!editing && (
            <p className="text-center text-caption text-text-2">{t('respond.noMoney')}</p>
          )}
          <Button size="lg" block onClick={submit} disabled={mutation.isPending || !agree}>
            {editing ? t('respond.save') : t('respond.submit')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <TextArea
          label={t('respond.cover')}
          placeholder={t('respond.coverPlaceholder')}
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          counterMax={2000}
          maxLength={2000}
          error={errors.coverLetter}
        />
        <Input
          label={t('respond.price')}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint={t('respond.priceHint', {
            v: formatMoney(task.reward_cents, 'ru-RU', { currency: task.currency }),
          })}
          error={errors.priceCents}
        />
        <Group title={t('respond.deadline')}>
          {DEADLINES.map((d) => (
            <Chip key={d} selected={deadline === d} onClick={() => setDeadline(d)}>
              {t(`deadline.${d}`)}
            </Chip>
          ))}
        </Group>
        <Group title={t('respond.ready')}>
          {READY.map((r) => (
            <Chip key={r} selected={ready === r} onClick={() => setReady(r)}>
              {t(`ready.${r}`)}
            </Chip>
          ))}
        </Group>
        {!!me.data?.skills.length && (
          <Group title={t('respond.skills')}>
            {me.data.skills.map((s) => (
              <Chip
                key={s}
                selected={skills.includes(s)}
                onClick={() =>
                  setSkills((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))
                }
              >
                {t(`skill.${s}` as TranslationKey)}
              </Chip>
            ))}
          </Group>
        )}
        <div className="flex flex-col gap-3">
          <span className="text-callout font-bold">{t('respond.links')}</span>
          {links.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={`${t('respond.links')} ${i + 1}`}
                  type="url"
                  placeholder="https://"
                  value={l}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                  error={errors[`portfolioLinks.${i}`]}
                />
              </div>
              <Button
                variant="glass"
                size="icon"
                aria-label={t('common.remove')}
                onClick={() => setLinks(links.filter((_, j) => j !== i))}
              >
                <X size={18} />
              </Button>
            </div>
          ))}
          {me.data && (
            <Link href="/account" className="text-callout font-bold text-accent-text">
              {t('respond.editPortfolio')}
            </Link>
          )}
          {links.length < 5 && (
            <div>
              <Button variant="glass" onClick={() => setLinks([...links, ''])}>
                <Plus size={18} strokeWidth={2.6} />
                {t('respond.addLink')}
              </Button>
            </div>
          )}
        </div>
        <Input
          label={t('respond.video')}
          hint={t('respond.videoHint')}
          type="url"
          placeholder="https://"
          value={video}
          onChange={(e) => setVideo(e.target.value)}
          error={errors.videoUrl}
        />
        {!editing && (
          <Checkbox checked={agree} onChange={setAgree}>
            {t('respond.agree')}
          </Checkbox>
        )}
      </div>
    </BottomSheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-callout font-bold">{title}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
