'use client';

import {
  CATEGORIES,
  DEADLINES,
  EXPERIENCE_LEVELS,
  LIMITS,
  NEARBY_RADII_M,
  RESULT_FORMATS,
  WORK_LANGUAGES,
  fieldErrors,
  files as filesApi,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatBps,
  languageName,
  parseDollars,
  priceBreakdown,
  rubToUsdCents,
  t,
  taskDraftSchema,
  taskExtras,
  tasks,
  toApiError,
  type Category,
  type ComposeResult,
  type Deadline,
  type ExperienceLevel,
  type FileRef,
  type MoneyCurrency,
  type ResultFormat,
  type TaskExtra,
  type TaskKind,
  type TranslationKey,
} from '@parri/shared';
import { keys, useMe, useRates, useSkills, useSupabase, useTaskDetail, useTaskDrafts } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, FileText, MapPin, Paperclip, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { ConfirmSheet } from '@/components/task/ConfirmSheet';
import { TaskCard } from '@/components/task/TaskCard';
import { FormError, Input, Select, TextArea, errorText } from '@/components/ui/Field';
import { CenterSpinner, PageTitle, SectionTitle } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';
import { useGeolocation } from '@/lib/useGeolocation';

const MAX_FILE = 50 * 1024 * 1024;
type InputCurrency = 'USD' | 'RUB' | 'USDT';
type Proof = NonNullable<TaskExtra['proofs']>[number];
const PROOFS: Proof[] = ['photo', 'checkin', 'comment'];

/** Всё, что хранится в черновике (без файлов и геоточки) */
interface FormState {
  kind: TaskKind;
  title: string;
  brief: string;
  description: string;
  category: Category | null;
  resultFormat: ResultFormat | null;
  checklist: string[];
  deadline: Deadline;
  radiusM: number;
  placeName: string;
  reward: string;
  inputCurrency: InputCurrency;
  language: string;
  level: ExperienceLevel | '';
  skills: string[];
  proofs: Proof[];
  visitWindow: string;
  building: string;
}

const EMPTY: FormState = {
  kind: 'online',
  title: '',
  brief: '',
  description: '',
  category: null,
  resultFormat: null,
  checklist: [''],
  deadline: '24h',
  radiusM: 250,
  placeName: '',
  reward: '',
  inputCurrency: 'USD',
  language: '',
  level: '',
  skills: [],
  proofs: [],
  visitWindow: '',
  building: '',
};

function Block({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-5" aria-labelledby={`block-${n}`}>
      <h2 id={`block-${n}`} className="flex items-center gap-3 text-title3 font-extrabold">
        <span className="flex size-8 items-center justify-center rounded-full bg-ink text-callout text-on-ink">{n}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Group({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && <p className="text-callout font-semibold text-danger">{errorText(error)}</p>}
    </div>
  );
}

function NewTaskForm() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const me = useMe();
  const geo = useGeolocation();
  const rates = useRates();
  const skillList = useSkills().data ?? [];
  const drafts = useTaskDrafts();
  const repeatId = params.get('repeat') ?? undefined;
  const repeat = useTaskDetail(repeatId).data;

  const [draftId, setDraftId] = useState(() => params.get('draft') ?? crypto.randomUUID());
  const [f, setF] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiVersions, setAiVersions] = useState<ComposeResult[]>([]);
  const [aiIdx, setAiIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rateConfirm, setRateConfirm] = useState(false);
  const loaded = useRef(false);
  const dirty = useRef(false);

  // Заполнить из черновика (?draft=) или по прошлой задаче (?repeat=)
  useEffect(() => {
    if (loaded.current) return;
    const draftParam = params.get('draft');
    if (draftParam && drafts.data) {
      const row = drafts.data.find((d) => d.id === draftParam);
      if (row) setF({ ...EMPTY, ...(row.data as Partial<FormState>) });
      loaded.current = true;
    } else if (repeatId && repeat) {
      const r = repeat.task;
      setF({
        ...EMPTY,
        kind: r.kind,
        title: r.title,
        brief: r.brief,
        description: r.description ?? '',
        category: r.category,
        resultFormat: r.result_format,
        checklist: r.checklist.length ? r.checklist : [''],
        deadline: r.deadline,
        radiusM: r.radius_m ?? 250,
        placeName: r.place_name ?? '',
        reward: String(r.reward_cents / 100),
        inputCurrency: r.currency === 'USDT' ? 'USDT' : 'USD',
        language: r.language ?? '',
        level: r.required_level ?? '',
        skills: r.skills,
        proofs: r.proofs as Proof[],
        visitWindow: r.visit_window ?? '',
        building: r.campus_building ?? '',
      });
      loaded.current = true;
    } else if (!draftParam && !repeatId) loaded.current = true;
  }, [params, drafts.data, repeat, repeatId]);

  // Автосохранение черновика через 1,5 с после последней правки
  useEffect(() => {
    if (!loaded.current || !dirty.current || !f.title.trim()) return;
    const id = setTimeout(() => {
      taskExtras
        .saveDraft(sb, draftId, f as unknown as Record<string, unknown>)
        .then(() => qc.invalidateQueries({ queryKey: keys.drafts }))
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(id);
  }, [f, draftId, sb, qc]);
  useEffect(() => {
    if (loaded.current) dirty.current = true;
  }, [f]);

  const rub = rates.data?.RUB;
  const paidIn: MoneyCurrency = f.inputCurrency === 'USDT' ? 'USDT' : 'USD';
  const entered = parseDollars(f.reward);
  const rewardCents = entered && entered > 0 ? (f.inputCurrency === 'RUB' ? (rub ? rubToUsdCents(entered, rub.per_usd) : null) : entered) : null;
  const price = rewardCents && rewardCents > 0 ? priceBreakdown(rewardCents) : null;
  const w = me.data?.wallet;
  const available = (paidIn === 'USDT' ? w?.usdt_available_cents : w?.available_cents) ?? 0;
  const shortBy = price ? price.total - available : 0;
  const uniName = me.data?.university?.name;
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: paidIn });
  const skillsForCategory = useMemo(() => {
    const own = skillList.filter((s) => s.category === f.category).map((s) => s.slug);
    return own.length ? own : skillList.slice(0, 24).map((s) => s.slug);
  }, [skillList, f.category]);
  const otherDrafts = (drafts.data ?? []).filter((d) => d.id !== draftId);

  const applyAi = (r: ComposeResult) =>
    setF((s) => ({ ...s, description: r.description, category: r.category, resultFormat: r.result_format, checklist: r.checklist.length ? r.checklist : s.checklist }));

  const compose = async () => {
    if (f.title.trim().length < 3 || !f.brief.trim()) return setFormError('create.aiNeedInput');
    setAiBusy(true);
    setFormError(null);
    try {
      const r = await tasks.composeWithAI(sb, { title: f.title, brief: f.brief, kind: f.kind, category: f.category });
      setAiVersions((v) => [...v, r]);
      setAiIdx(aiVersions.length);
      applyAi(r);
      toast(t('create.aiDone'));
    } catch (e) {
      setFormError(toApiError(e).key);
    } finally {
      setAiBusy(false);
    }
  };
  const switchAi = (i: number) => {
    setAiIdx(i);
    applyAi(aiVersions[i]!);
  };

  const saveDraft = async () => {
    try {
      await taskExtras.saveDraft(sb, draftId, f as unknown as Record<string, unknown>);
      await qc.invalidateQueries({ queryKey: keys.drafts });
      toast(t('create.draftSaved'));
    } catch (e) {
      setFormError(toApiError(e).key);
    }
  };

  const publish = async (rate = rub) => {
    const cents = f.inputCurrency === 'RUB' ? (rate && entered ? rubToUsdCents(entered, rate.per_usd) : NaN) : (entered ?? NaN);
    const parsed = taskDraftSchema.safeParse({
      title: f.title,
      brief: f.brief,
      description: f.description,
      category: f.category ?? undefined,
      resultFormat: f.resultFormat ?? undefined,
      checklist: f.checklist.map((c) => c.trim()).filter(Boolean),
      deadline: f.deadline,
      kind: f.kind,
      rewardCents: cents,
      lat: geo.coords?.lat ?? null,
      lng: geo.coords?.lng ?? null,
      radiusM: f.kind === 'nearby' ? f.radiusM : null,
      placeName: f.placeName,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError('errors.check_failed');
      return;
    }
    if (attachments.some((x) => x.size > MAX_FILE)) return setFormError('errors.file_too_big');
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const uid = me.data!.profile.id;
      const refs: FileRef[] = [];
      for (const file of attachments) {
        const path = filesApi.path(uid, id, 'brief', file.name, crypto.randomUUID());
        await filesApi.upload(sb, path, file, file.type || 'application/octet-stream');
        refs.push({ path, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' });
      }
      await tasks.publish(
        sb,
        id,
        parsed.data,
        refs,
        f.inputCurrency === 'RUB'
          ? { currency: 'USD', inputCurrency: 'RUB', inputAmount: entered, rateFetchedAt: rate?.fetched_at ?? null }
          : { currency: paidIn },
        {
          language: f.language || null,
          requiredLevel: f.level || null,
          proofs: f.kind === 'nearby' ? f.proofs : [],
          visitWindow: f.kind !== 'online' ? f.visitWindow.trim() || null : null,
          campusBuilding: f.kind === 'campus' ? f.building.trim() || null : null,
          skills: f.skills,
        },
      );
      await taskExtras.deleteDraft(sb, draftId).catch(() => undefined);
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.me }),
        qc.invalidateQueries({ queryKey: ['my-tasks'] }),
        qc.invalidateQueries({ queryKey: keys.drafts }),
      ]);
      toast(t('create.published'));
      router.push(`/tasks/${id}`);
    } catch (e) {
      const err = toApiError(e);
      setBusy(false);
      if (err.key === 'errors.rate_changed') {
        await qc.invalidateQueries({ queryKey: keys.rates });
        await rates.refetch();
        setRateConfirm(true);
      } else setFormError(err.key);
    }
  };

  const preview = (
    <div className="flex flex-col gap-3">
      <p className="text-caption uppercase tracking-wide text-text-2">{t('create.preview')}</p>
      <TaskCard
        task={{
          id: 'preview',
          title: f.title.trim() || t('create.namePlaceholder'),
          rewardCents: rewardCents ?? 0,
          kind: f.kind,
          category: f.category ?? 'other',
          deadline: f.deadline,
          distanceM: undefined,
          campusName: f.kind === 'campus' ? uniName : undefined,
        }}
        priceLabel={fmt(rewardCents ?? 0)}
        footer={(f.description || f.brief) && <p className="line-clamp-4 whitespace-pre-line text-callout text-text-2">{f.description || f.brief}</p>}
      />
      {otherDrafts.length > 0 && (
        <Card className="flex flex-col gap-2">
          <p className="font-bold">{t('create.drafts')}</p>
          {otherDrafts.slice(0, 5).map((d) => (
            <div key={d.id} className="tile flex items-center gap-2 px-3 py-2">
              <FileText size={16} className="shrink-0 text-text-2" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setDraftId(d.id);
                  setF({ ...EMPTY, ...(d.data as Partial<FormState>) });
                  router.replace(`/tasks/new?draft=${d.id}`);
                }}
              >
                <span className="block truncate text-callout font-semibold">{String(d.data.title || '') || t('create.untitled')}</span>
                <span className="text-caption text-text-2">{formatDateTime(d.updated_at)}</span>
              </button>
              <Button
                variant="plain"
                size="icon"
                aria-label={t('create.draftDelete')}
                onClick={() => taskExtras.deleteDraft(sb, d.id).then(() => qc.invalidateQueries({ queryKey: keys.drafts }))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  return (
    <>
      <Header title={t('create.title')} />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-8 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <PageTitle subtitle={repeat ? t('create.repeatFrom', { title: repeat.task.title }) : t('create.draftAuto')}>{t('create.title')}</PageTitle>

          <Block n={1} title={t('create.block1')}>
            <Segmented<TaskKind>
              label={t('create.kind')}
              value={f.kind}
              onChange={(k) => setF((s) => ({ ...s, kind: k, resultFormat: k === 'nearby' ? (s.resultFormat ?? 'photo') : s.resultFormat }))}
              options={[
                { value: 'online', label: t('kind.online') },
                { value: 'nearby', label: t('kind.nearby') },
                { value: 'campus', label: t('kind.campus') },
              ]}
            />
            {f.kind === 'campus' && (
              <p className={clsx('text-callout font-semibold', uniName ? 'text-text-2' : 'text-danger')}>
                {uniName ? t('create.campusFor', { name: uniName }) : t('errors.university_required')}
              </p>
            )}
            <Input
              label={t('create.name')}
              placeholder={t('create.namePlaceholder')}
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={LIMITS.titleMax}
              counterMax={LIMITS.titleMax}
              error={errors.title}
            />
            <TextArea
              label={t('create.brief')}
              placeholder={t('create.briefPlaceholder')}
              value={f.brief}
              onChange={(e) => set('brief', e.target.value)}
              maxLength={LIMITS.briefMax}
              counterMax={LIMITS.briefMax}
              rows={3}
              error={errors.brief}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="glass" onClick={compose} disabled={aiBusy}>
                <Sparkles size={18} strokeWidth={2.4} className="text-accent-text" />
                {aiBusy ? t('create.aiWorking') : t('create.ai')}
              </Button>
              {aiVersions.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="plain" size="icon" aria-label={t('create.aiPrev')} disabled={aiIdx === 0} onClick={() => switchAi(aiIdx - 1)}>
                    <ChevronLeft size={18} />
                  </Button>
                  <span className="tabular text-callout font-semibold">{t('create.aiVersion', { n: aiIdx + 1, m: aiVersions.length })}</span>
                  <Button variant="plain" size="icon" aria-label={t('create.aiNext')} disabled={aiIdx === aiVersions.length - 1} onClick={() => switchAi(aiIdx + 1)}>
                    <ChevronRight size={18} />
                  </Button>
                </div>
              )}
            </div>
            <TextArea
              label={t('create.description')}
              placeholder={t('create.descriptionPlaceholder')}
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
              rows={6}
              maxLength={4000}
              error={errors.description}
            />
            <Group title={t('create.category')} error={errors.category}>
              {CATEGORIES.map((c) => (
                <Chip key={c} selected={f.category === c} onClick={() => set('category', c)}>
                  {t(`category.${c}`)}
                </Chip>
              ))}
            </Group>
            <Group title={t('create.resultFormat')} error={errors.resultFormat}>
              {RESULT_FORMATS.map((x) => (
                <Chip key={x} selected={f.resultFormat === x} onClick={() => set('resultFormat', x)}>
                  {t(`format.${x}`)}
                </Chip>
              ))}
            </Group>
          </Block>

          <Block n={2} title={t('create.block2')}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <SectionTitle>{t('create.checklist')}</SectionTitle>
                <p className="text-callout text-text-2">{t('create.checklistHint')}</p>
              </div>
              {f.checklist.map((item, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label={`${i + 1}.`}
                      placeholder={t('create.checklistPlaceholder')}
                      value={item}
                      maxLength={200}
                      onChange={(e) => set('checklist', f.checklist.map((c, j) => (j === i ? e.target.value : c)))}
                    />
                  </div>
                  <Button variant="glass" size="icon" aria-label={t('common.remove')} onClick={() => set('checklist', f.checklist.filter((_, j) => j !== i))}>
                    <Trash2 size={18} />
                  </Button>
                </div>
              ))}
              {f.checklist.length < 10 && (
                <div>
                  <Button variant="glass" onClick={() => set('checklist', [...f.checklist, ''])}>
                    <Plus size={18} strokeWidth={2.6} />
                    {t('create.checklistAdd')}
                  </Button>
                </div>
              )}
            </div>

            <Group title={t('create.deadline')}>
              {DEADLINES.map((d) => (
                <Chip key={d} selected={f.deadline === d} onClick={() => set('deadline', d)}>
                  {t(`deadline.${d}`)}
                </Chip>
              ))}
            </Group>

            {f.kind === 'nearby' && (
              <div className="flex flex-col gap-4 rounded-lg bg-fill/60 p-4">
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
                {(geo.state === 'denied' || geo.state === 'unavailable') && <p className="text-callout font-semibold text-danger">{t('feed.geoDenied')}</p>}
                {errors.lat && <p className="text-callout font-semibold text-danger">{errorText(errors.lat)}</p>}
                <Group title={t('create.radius')}>
                  {NEARBY_RADII_M.map((r) => (
                    <Chip key={r} selected={f.radiusM === r} onClick={() => set('radiusM', r)}>
                      {formatDistance(r)}
                    </Chip>
                  ))}
                </Group>
                <Input label={t('create.placeName')} value={f.placeName} onChange={(e) => set('placeName', e.target.value)} maxLength={120} />
                <Group title={t('create.proofsTitle')}>
                  {PROOFS.map((p) => (
                    <Chip key={p} selected={f.proofs.includes(p)} onClick={() => set('proofs', f.proofs.includes(p) ? f.proofs.filter((x) => x !== p) : [...f.proofs, p])}>
                      {t(`create.proofs.${p}`)}
                    </Chip>
                  ))}
                </Group>
              </div>
            )}
            {f.kind === 'campus' && (
              <Input label={t('create.building')} value={f.building} onChange={(e) => set('building', e.target.value)} maxLength={120} />
            )}
            {f.kind !== 'online' && (
              <Input
                label={t('create.visitWindow')}
                placeholder={t('create.visitWindowPlaceholder')}
                value={f.visitWindow}
                onChange={(e) => set('visitWindow', e.target.value)}
                maxLength={120}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t('create.language')}
                value={f.language}
                onChange={(e) => set('language', e.target.value)}
                placeholder={t('create.anyLanguage')}
                options={WORK_LANGUAGES.map((l) => ({ value: l, label: languageName(l) }))}
              />
              <Select
                label={t('create.level')}
                value={f.level}
                onChange={(e) => set('level', e.target.value as ExperienceLevel | '')}
                placeholder={t('create.anyLevel')}
                options={EXPERIENCE_LEVELS.map((l) => ({ value: l, label: t(`onb.exp.${l}`) }))}
              />
            </div>
            {skillsForCategory.length > 0 && (
              <Group title={t('create.skills')}>
                {skillsForCategory.map((s) => (
                  <Chip
                    key={s}
                    selected={f.skills.includes(s)}
                    onClick={() => set('skills', f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s].slice(0, 10))}
                  >
                    {t(`skill.${s}` as TranslationKey)}
                  </Chip>
                ))}
              </Group>
            )}

            <div className="flex flex-col gap-3">
              <SectionTitle>{t('create.attachments')}</SectionTitle>
              {attachments.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {attachments.map((file, i) => (
                    <li key={i} className="tile flex items-center justify-between gap-3 px-4 py-3">
                      <span className="truncate font-semibold">{file.name}</span>
                      <button type="button" aria-label={t('common.remove')} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>
                        <X size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {attachments.length < 10 && (
                <label className="inline-flex h-12 w-fit cursor-pointer items-center gap-2 rounded-pill bg-fill px-6 font-bold">
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
            </div>
          </Block>

          <Block n={3} title={t('create.block3')}>
            <Segmented<InputCurrency>
              label={t('create.currency')}
              value={f.inputCurrency}
              onChange={(c) => set('inputCurrency', c)}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'RUB', label: 'RUB' },
                { value: 'USDT', label: 'USDT' },
              ]}
            />
            <Input
              label={`${t('create.reward')} · ${f.inputCurrency}`}
              inputMode="decimal"
              placeholder={f.inputCurrency === 'RUB' ? '2500' : '25'}
              value={f.reward}
              onChange={(e) => set('reward', e.target.value)}
              hint={t('create.rewardHint')}
              error={errors.rewardCents}
            />
            {f.inputCurrency === 'RUB' &&
              (rub ? (
                <p className="text-callout text-text-2">
                  {t('create.rubHint', { rate: rub.per_usd.toFixed(2), date: formatDateTime(rub.fetched_at) })}
                  {rewardCents ? (
                    <>
                      <br />
                      <span className="font-semibold text-text">{t('create.rubEquals', { v: formatMoney(rewardCents) })}</span>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-callout font-semibold text-danger">{t('create.noRate')}</p>
              ))}
            {f.inputCurrency === 'USDT' && <p className="text-callout text-text-2">{t('create.usdtHint')}</p>}
            <dl className="flex flex-col gap-2 text-body">
              <div className="flex justify-between">
                <dt className="text-text-2">{t('create.reward')}</dt>
                <dd className="tabular font-semibold">{fmt(price?.reward ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">
                  {t('create.fee')}
                  {price ? ` · ${formatBps(price.feeBps)}` : ''}
                </dt>
                <dd className="tabular font-semibold">{fmt(price?.fee ?? 0)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-separator pt-3">
                <dt className="text-title3 font-bold">{t('create.total')}</dt>
                <dd className="tabular text-price font-extrabold text-accent-text" data-testid="total">
                  {fmt(price?.total ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">{t('create.balanceIn', { c: paidIn })}</dt>
                <dd className="tabular font-semibold">{fmt(available)}</dd>
              </div>
            </dl>
            <p className="text-callout text-text-2">{t('fees.rule')}</p>
            <p className="text-callout text-text-2">{t('create.safeHint')}</p>
            {shortBy > 0 && (
              <p role="alert" className="rounded-md bg-warning/12 px-4 py-3 text-callout font-semibold text-warning">
                {t('create.notEnough', { v: fmt(shortBy) })}
              </p>
            )}
          </Block>

          <Block n={4} title={t('create.block4')}>
            <div className="lg:hidden">{preview}</div>
            <FormError error={formError} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" block onClick={() => publish()} disabled={busy || shortBy > 0 || (f.inputCurrency === 'RUB' && !rub)}>
                {t('create.publish', { v: fmt(price?.total ?? 0) })}
              </Button>
              <Button size="lg" variant="glass" onClick={saveDraft} disabled={!f.title.trim()}>
                {t('create.saveDraft')}
              </Button>
            </div>
          </Block>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">{preview}</div>
        </aside>
      </main>
      <ConfirmSheet
        open={rateConfirm}
        onClose={() => setRateConfirm(false)}
        title={t('create.rateChangedTitle')}
        text={
          rub && entered
            ? t('create.rateChangedText', { rate: rub.per_usd.toFixed(2), v: formatMoney(rubToUsdCents(entered, rub.per_usd)) })
            : t('errors.rate_changed')
        }
        confirmLabel={t('create.rateConfirm')}
        onConfirm={() => {
          setRateConfirm(false);
          void publish(rates.data?.RUB);
        }}
        busy={busy}
      />
    </>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <NewTaskForm />
    </Suspense>
  );
}

