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
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { FormError, Input, TextArea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

const READY: ReadyWhen[] = ['now', 'in_1h', 'today', 'tomorrow'];

/** Форма отклика: письмо от 20 символов, своя цена и срок, навыки, портфолио, когда готов начать */
export function RespondSheet({ open, onClose, task, existing }: { open: boolean; onClose: () => void; task: Task; existing?: TaskResponse | null }) {
  const me = useMe();
  const toast = useToast();
  const [cover, setCover] = useState(existing?.cover_letter ?? '');
  const [price, setPrice] = useState(String((existing?.price_cents ?? task.reward_cents) / 100));
  const [deadline, setDeadline] = useState<Deadline>(existing?.deadline ?? task.deadline);
  const [skills, setSkills] = useState<string[]>(existing?.skills ?? []);
  const [links, setLinks] = useState<string[]>(existing?.portfolio_links.length ? existing.portfolio_links : ['']);
  const [ready, setReady] = useState<ReadyWhen>(existing?.ready ?? 'now');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!existing && existing.status === 'pending';

  const mutation = useApiMutation(
    (sb, v: Parameters<typeof responses.submit>[2]) =>
      editing ? responses.update(sb, existing!.id, v) : responses.submit(sb, task.id, v),
    {
      invalidate: () => [keys.task(task.id), ['feed'], ['my-tasks']],
      onSuccess: () => {
        toast(t('respond.sent'));
        onClose();
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
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    mutation.mutate(parsed.data);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('respond.title')}
      footer={
        <div className="flex flex-col gap-3">
          <FormError error={mutation.error?.key} />
          <Button size="lg" block onClick={submit} disabled={mutation.isPending}>
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
          hint={t('respond.priceHint', { v: formatMoney(task.reward_cents) })}
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
              <Chip key={s} selected={skills.includes(s)} onClick={() => setSkills((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}>
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
              <Button variant="glass" size="icon" aria-label={t('common.remove')} onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                <X size={18} />
              </Button>
            </div>
          ))}
          {links.length < 5 && (
            <div>
              <Button variant="glass" onClick={() => setLinks([...links, ''])}>
                <Plus size={18} strokeWidth={2.6} />
                {t('respond.addLink')}
              </Button>
            </div>
          )}
        </div>
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
