'use client';

import {
  CATEGORIES,
  DEADLINES,
  LIMITS,
  NEARBY_RADII_M,
  RESULT_FORMATS,
  fieldErrors,
  files as filesApi,
  formatDistance,
  formatMoney,
  parseDollars,
  priceBreakdown,
  t,
  taskDraftSchema,
  tasks,
  toApiError,
  type Category,
  type Deadline,
  type FileRef,
  type ResultFormat,
  type TaskKind,
} from '@parri/shared';
import { keys, useMe, useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Paperclip, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { TaskCard } from '@/components/task/TaskCard';
import { FormError, Input, TextArea, errorText } from '@/components/ui/Field';
import { PageTitle, SectionTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { useGeolocation } from '@/lib/useGeolocation';

const MAX_FILE = 50 * 1024 * 1024;

export default function NewTaskPage() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const geo = useGeolocation();

  const [kind, setKind] = useState<TaskKind>('online');
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [resultFormat, setResultFormat] = useState<ResultFormat | null>(null);
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [deadline, setDeadline] = useState<Deadline>('24h');
  const [radiusM, setRadiusM] = useState<number>(250);
  const [placeName, setPlaceName] = useState('');
  const [reward, setReward] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const rewardCents = parseDollars(reward);
  const price = rewardCents && rewardCents > 0 ? priceBreakdown(rewardCents) : null;
  const available = me.data?.wallet.available_cents ?? 0;
  const shortBy = price ? price.total - available : 0;
  const uniName = me.data?.university?.name;

  const compose = async () => {
    if (title.trim().length < 3 || !brief.trim()) {
      setFormError('create.aiNeedInput');
      return;
    }
    setAiBusy(true);
    setFormError(null);
    try {
      const r = await tasks.composeWithAI(sb, { title, brief, kind, category });
      setDescription(r.description);
      setCategory(r.category);
      setResultFormat(r.result_format);
      if (r.checklist.length) setChecklist(r.checklist);
      toast(t('create.aiDone'));
    } catch (e) {
      setFormError(toApiError(e).key);
    } finally {
      setAiBusy(false);
    }
  };

  const publish = async () => {
    const draft = {
      title,
      brief,
      description,
      category: category ?? undefined,
      resultFormat: resultFormat ?? undefined,
      checklist: checklist.map((c) => c.trim()).filter(Boolean),
      deadline,
      kind,
      rewardCents: rewardCents ?? NaN,
      lat: geo.coords?.lat ?? null,
      lng: geo.coords?.lng ?? null,
      radiusM: kind === 'nearby' ? radiusM : null,
      placeName,
    };
    const parsed = taskDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError('errors.check_failed');
      return;
    }
    if (attachments.some((f) => f.size > MAX_FILE)) return setFormError('errors.file_too_big');
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const uid = me.data!.profile.id;
      const refs: FileRef[] = [];
      for (const f of attachments) {
        const path = filesApi.path(uid, id, 'brief', f.name, crypto.randomUUID());
        await filesApi.upload(sb, path, f, f.type || 'application/octet-stream');
        refs.push({ path, name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
      }
      await tasks.publish(sb, id, parsed.data, refs);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: ['my-tasks'] })]);
      toast(t('create.published'));
      router.push(`/tasks/${id}`);
    } catch (e) {
      setFormError(toApiError(e).key);
      setBusy(false);
    }
  };

  const preview = (
    <div className="flex flex-col gap-3">
      <p className="text-caption uppercase tracking-wide text-text-2">{t('create.preview')}</p>
      <TaskCard
        task={{
          id: 'preview',
          title: title.trim() || t('create.namePlaceholder'),
          rewardCents: rewardCents ?? 0,
          kind,
          category: category ?? 'other',
          deadline,
          distanceM: undefined,
          campusName: kind === 'campus' ? uniName : undefined,
        }}
        footer={
          (description || brief) && (
            <p className="line-clamp-4 whitespace-pre-line text-callout text-text-2">{description || brief}</p>
          )
        }
      />
    </div>
  );

  return (
    <>
      <Header title={t('create.title')} />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-8 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-8">
          <PageTitle>{t('create.title')}</PageTitle>

          <section className="flex flex-col gap-3">
            <SectionTitle>{t('create.kind')}</SectionTitle>
            <Segmented<TaskKind>
              label={t('create.kind')}
              value={kind}
              onChange={(k) => {
                setKind(k);
                if (k === 'nearby') setResultFormat((f) => f ?? 'photo');
              }}
              options={[
                { value: 'online', label: t('kind.online') },
                { value: 'nearby', label: t('kind.nearby') },
                { value: 'campus', label: t('kind.campus') },
              ]}
            />
            {kind === 'campus' && (
              <p className={`text-callout font-semibold ${uniName ? 'text-text-2' : 'text-danger'}`}>
                {uniName ? t('create.campusFor', { name: uniName }) : t('errors.university_required')}
              </p>
            )}
          </section>

          <section className="card flex flex-col gap-5 p-5 md:p-6">
            <Input
              label={t('create.name')}
              placeholder={t('create.namePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.titleMax}
              counterMax={LIMITS.titleMax}
              error={errors.title}
            />
            <TextArea
              label={t('create.brief')}
              placeholder={t('create.briefPlaceholder')}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={LIMITS.briefMax}
              counterMax={LIMITS.briefMax}
              rows={3}
              error={errors.brief}
            />
            <div>
              <Button variant="glass" onClick={compose} disabled={aiBusy}>
                <Sparkles size={18} strokeWidth={2.4} className="text-accent-text" />
                {aiBusy ? t('create.aiWorking') : t('create.ai')}
              </Button>
            </div>
            <TextArea
              label={t('create.description')}
              placeholder={t('create.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              maxLength={4000}
              error={errors.description}
            />
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>{t('create.category')}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
                  {t(`category.${c}`)}
                </Chip>
              ))}
            </div>
            {errors.category && <p className="text-callout font-semibold text-danger">{errorText(errors.category)}</p>}
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>{t('create.resultFormat')}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {RESULT_FORMATS.map((f) => (
                <Chip key={f} selected={resultFormat === f} onClick={() => setResultFormat(f)}>
                  {t(`format.${f}`)}
                </Chip>
              ))}
            </div>
            {errors.resultFormat && <p className="text-callout font-semibold text-danger">{errorText(errors.resultFormat)}</p>}
          </section>

          <section className="card flex flex-col gap-4 p-5 md:p-6">
            <div className="flex flex-col gap-1">
              <SectionTitle>{t('create.checklist')}</SectionTitle>
              <p className="text-callout text-text-2">{t('create.checklistHint')}</p>
            </div>
            {checklist.map((item, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={`${i + 1}.`}
                    placeholder={t('create.checklistPlaceholder')}
                    value={item}
                    maxLength={200}
                    onChange={(e) => setChecklist(checklist.map((c, j) => (j === i ? e.target.value : c)))}
                  />
                </div>
                <Button
                  variant="glass"
                  size="icon"
                  aria-label={t('common.remove')}
                  onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))}
            {checklist.length < 10 && (
              <div>
                <Button variant="glass" onClick={() => setChecklist([...checklist, ''])}>
                  <Plus size={18} strokeWidth={2.6} />
                  {t('create.checklistAdd')}
                </Button>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>{t('create.deadline')}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {DEADLINES.map((d) => (
                <Chip key={d} selected={deadline === d} onClick={() => setDeadline(d)}>
                  {t(`deadline.${d}`)}
                </Chip>
              ))}
            </div>
          </section>

          {kind === 'nearby' && (
            <section className="card flex flex-col gap-4 p-5 md:p-6">
              <SectionTitle>{t('create.location')}</SectionTitle>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="glass" onClick={geo.request} disabled={geo.state === 'locating'}>
                  <MapPin size={18} strokeWidth={2.4} />
                  {geo.state === 'locating' ? t('feed.geoLocating') : t('create.useMyLocation')}
                </Button>
                {geo.coords && (
                  <span className="tabular text-callout font-semibold text-text-2">
                    {t('create.locationSet', { lat: geo.coords.lat.toFixed(5), lng: geo.coords.lng.toFixed(5) })}
                  </span>
                )}
              </div>
              {(geo.state === 'denied' || geo.state === 'unavailable') && (
                <p className="text-callout font-semibold text-danger">{t('feed.geoDenied')}</p>
              )}
              {errors.lat && <p className="text-callout font-semibold text-danger">{errorText(errors.lat)}</p>}
              <div className="flex flex-col gap-2">
                <span className="text-callout font-bold">{t('create.radius')}</span>
                <div className="flex flex-wrap gap-2">
                  {NEARBY_RADII_M.map((r) => (
                    <Chip key={r} selected={radiusM === r} onClick={() => setRadiusM(r)}>
                      {formatDistance(r)}
                    </Chip>
                  ))}
                </div>
              </div>
              <Input label={t('create.placeName')} value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={120} />
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionTitle>{t('create.attachments')}</SectionTitle>
            {attachments.length > 0 && (
              <ul className="flex flex-col gap-2">
                {attachments.map((f, i) => (
                  <li key={i} className="card flex items-center justify-between gap-3 px-4 py-3">
                    <span className="truncate font-semibold">{f.name}</span>
                    <button type="button" aria-label={t('common.remove')} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>
                      <X size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attachments.length < 10 && (
              <label className="glass inline-flex h-12 w-fit cursor-pointer items-center gap-2 rounded-pill px-6 font-bold">
                <Paperclip size={18} strokeWidth={2.4} />
                {t('create.attach')}
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    setAttachments((prev) => [...prev, ...list].slice(0, 10));
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </section>

          <section className="card flex flex-col gap-4 p-5 md:p-6" aria-labelledby="budget-title">
            <h2 id="budget-title" className="text-title3 font-bold">
              {t('create.budgetTitle')}
            </h2>
            <Input
              label={t('create.reward')}
              inputMode="decimal"
              placeholder="25"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              hint={t('create.rewardHint')}
              error={errors.rewardCents}
            />
            <dl className="flex flex-col gap-2 text-body">
              <div className="flex justify-between">
                <dt className="text-text-2">{t('create.reward')}</dt>
                <dd className="tabular font-semibold">{formatMoney(price?.reward ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">{t('create.fee')}</dt>
                <dd className="tabular font-semibold">{formatMoney(price?.fee ?? 0)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-separator pt-3">
                <dt className="text-title3 font-bold">{t('create.total')}</dt>
                <dd className="tabular text-price font-extrabold text-accent-text" data-testid="total">
                  {formatMoney(price?.total ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">{t('create.balance')}</dt>
                <dd className="tabular font-semibold">{formatMoney(available)}</dd>
              </div>
            </dl>
            <p className="text-callout text-text-2">{t('fees.rule')}</p>
            <p className="text-callout text-text-2">{t('create.safeHint')}</p>
            {shortBy > 0 && (
              <p role="alert" className="rounded-md bg-warning/12 px-4 py-3 text-callout font-semibold text-warning">
                {t('create.notEnough', { v: formatMoney(shortBy) })}
              </p>
            )}
          </section>

          <div className="lg:hidden">{preview}</div>

          <FormError error={formError} />
          <Button size="lg" block onClick={publish} disabled={busy || shortBy > 0}>
            {t('create.publish', { v: formatMoney(price?.total ?? 0) })}
          </Button>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">{preview}</div>
        </aside>
      </main>
    </>
  );
}
