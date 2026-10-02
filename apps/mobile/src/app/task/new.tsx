import {
  CATEGORIES,
  DEADLINES,
  EXPERIENCE_LEVELS,
  LIMITS,
  NEARBY_RADII_M,
  RESULT_FORMATS,
  WORK_LANGUAGES,
  fieldErrors,
  formatBps,
  formatDateTime,
  formatDistance,
  formatMoney,
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
  type MoneyCurrency,
  type ResultFormat,
  type TaskExtra,
  type TaskKind,
  type TranslationKey,
} from '@parri/shared';
import {
  keys,
  useMe,
  useRates,
  useSkills,
  useSupabase,
  useTaskDetail,
  useTaskDrafts,
} from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
} from '@/components/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { ConfirmSheet, FilePicker, uploadPicked } from '@/components/task/Sheets';
import { TaskCard } from '@/components/task/TaskCard';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField, errorText } from '@/components/ui/TextField';
import { Label, PageTitle, Row, SectionTitle, useToast } from '@/components/ui/bits';
import { Card, ListGroup, ListRow } from '@/components/ui/kit';
import type { PickedFile } from '@/lib/files';
import { MAX_FILE_BYTES } from '@/lib/files';
import { useDeviceLocation } from '@/lib/location';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

type InputCurrency = 'USD' | 'RUB' | 'USDT';
type Proof = NonNullable<TaskExtra['proofs']>[number];
const PROOFS: Proof[] = ['photo', 'checkin', 'comment'];

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

function uuid(): string {
  // RFC 4122 v4 без зависимостей (crypto.randomUUID есть не во всех движках RN)
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function Block({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="callout"
            color="background"
            style={{ color: colors.onInk, fontFamily: familyByWeight['800'] }}
          >
            {n}
          </AppText>
        </View>
        <AppText variant="title3" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </Card>
  );
}

export default function NewTask() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const { colors } = useTheme();
  const me = useMe();
  const geo = useDeviceLocation();
  const rates = useRates();
  const skillList = useSkills().data ?? [];
  const drafts = useTaskDrafts();
  const params = useLocalSearchParams<{ draft?: string; repeat?: string }>();
  const repeat = useTaskDetail(params.repeat).data;
  const [draftId, setDraftId] = useState(() => params.draft ?? uuid());
  const [f, setF] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiVersions, setAiVersions] = useState<ComposeResult[]>([]);
  const [aiIdx, setAiIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rateConfirm, setRateConfirm] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    if (params.draft && drafts.data) {
      const row = drafts.data.find((d) => d.id === params.draft);
      if (row) setF({ ...EMPTY, ...(row.data as Partial<FormState>) });
      loaded.current = true;
    } else if (params.repeat && repeat) {
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
    } else if (!params.draft && !params.repeat) loaded.current = true;
  }, [params.draft, params.repeat, drafts.data, repeat]);

  // Автосохранение черновика
  useEffect(() => {
    if (!loaded.current || !f.title.trim()) return;
    const id = setTimeout(() => {
      taskExtras
        .saveDraft(sb, draftId, f as unknown as Record<string, unknown>)
        .then(() => qc.invalidateQueries({ queryKey: keys.drafts }))
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(id);
  }, [f, draftId, sb, qc]);

  const rub = rates.data?.RUB;
  const paidIn: MoneyCurrency = f.inputCurrency === 'USDT' ? 'USDT' : 'USD';
  const entered = parseDollars(f.reward);
  const rewardCents =
    entered && entered > 0
      ? f.inputCurrency === 'RUB'
        ? rub
          ? rubToUsdCents(entered, rub.per_usd)
          : null
        : entered
      : null;
  const price = rewardCents && rewardCents > 0 ? priceBreakdown(rewardCents) : null;
  const w = me.data?.wallet;
  const available = (paidIn === 'USDT' ? w?.usdt_available_cents : w?.available_cents) ?? 0;
  const shortBy = price ? price.total - available : 0;
  const uniName = me.data?.university?.name;
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: paidIn });
  const skillsForCategory = useMemo(() => {
    const own = skillList.filter((s) => s.category === f.category).map((s) => s.slug);
    return own.length ? own : skillList.slice(0, 18).map((s) => s.slug);
  }, [skillList, f.category]);
  const otherDrafts = (drafts.data ?? []).filter((d) => d.id !== draftId);

  const applyAi = (r: ComposeResult) =>
    setF((s) => ({
      ...s,
      description: r.description,
      category: r.category,
      resultFormat: r.result_format,
      checklist: r.checklist.length ? r.checklist : s.checklist,
    }));
  const compose = async () => {
    if (f.title.trim().length < 3 || !f.brief.trim()) return setFormError('create.aiNeedInput');
    setAiBusy(true);
    setFormError(null);
    try {
      const r = await tasks.composeWithAI(sb, {
        title: f.title,
        brief: f.brief,
        kind: f.kind,
        category: f.category,
      });
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
    const cents =
      f.inputCurrency === 'RUB'
        ? rate && entered
          ? rubToUsdCents(entered, rate.per_usd)
          : NaN
        : (entered ?? NaN);
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
      return setFormError('errors.check_failed');
    }
    if (files.some((x) => x.size > MAX_FILE_BYTES)) return setFormError('errors.file_too_big');
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const id = uuid();
      const refs = await uploadPicked(sb, me.data!.profile.id, id, 'brief', files);
      await tasks.publish(
        sb,
        id,
        parsed.data,
        refs,
        f.inputCurrency === 'RUB'
          ? {
              currency: 'USD',
              inputCurrency: 'RUB',
              inputAmount: entered,
              rateFetchedAt: rate?.fetched_at ?? null,
            }
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
      router.replace(`/task/${id}`);
    } catch (e) {
      const err = toApiError(e);
      setBusy(false);
      if (err.key === 'errors.rate_changed') {
        await rates.refetch();
        setRateConfirm(true);
      } else setFormError(err.key);
    }
  };

  const fieldError = (k: string) =>
    errors[k] ? (
      <AppText variant="callout" color="danger" style={{ fontFamily: familyByWeight['600'] }}>
        {errorText(errors[k])}
      </AppText>
    ) : null;

  return (
    <Screen
      title={t('create.title')}
      leading={<BackButton />}
      overlay={
        <ConfirmSheet
          open={rateConfirm}
          onClose={() => setRateConfirm(false)}
          title={t('create.rateChangedTitle')}
          text={
            rub && entered
              ? t('create.rateChangedText', {
                  rate: rub.per_usd.toFixed(2),
                  v: formatMoney(rubToUsdCents(entered, rub.per_usd)),
                })
              : t('errors.rate_changed')
          }
          confirmLabel={t('create.rateConfirm')}
          onConfirm={() => {
            setRateConfirm(false);
            void publish(rates.data?.RUB);
          }}
          busy={busy}
        />
      }
    >
      <PageTitle
        subtitle={
          repeat ? t('create.repeatFrom', { title: repeat.task.title }) : t('create.draftAuto')
        }
      >
        {t('create.title')}
      </PageTitle>
      {otherDrafts.length > 0 && (
        <ListGroup title={t('create.drafts')}>
          {otherDrafts.slice(0, 3).map((d) => (
            <ListRow
              key={d.id}
              icon={(c) => <FileText size={18} color={c} />}
              title={String(d.data.title || '') || t('create.untitled')}
              subtitle={formatDateTime(d.updated_at)}
              onPress={() => {
                setDraftId(d.id);
                setF({ ...EMPTY, ...(d.data as Partial<FormState>) });
              }}
            />
          ))}
        </ListGroup>
      )}

      <Block n={1} title={t('create.block1')}>
        <Segmented
          value={f.kind}
          onChange={(k) =>
            setF((s) => ({
              ...s,
              kind: k,
              resultFormat: k === 'nearby' ? (s.resultFormat ?? 'photo') : s.resultFormat,
            }))
          }
          options={[
            { value: 'online', label: t('kind.online') },
            { value: 'nearby', label: t('kind.nearby') },
            { value: 'campus', label: t('kind.campus') },
          ]}
        />
        {f.kind === 'campus' && (
          <AppText variant="callout" color={uniName ? 'textSecondary' : 'danger'}>
            {uniName ? t('create.campusFor', { name: uniName }) : t('errors.university_required')}
          </AppText>
        )}
        <TextField
          label={t('create.name')}
          placeholder={t('create.namePlaceholder')}
          value={f.title}
          onChangeText={(v) => set('title', v)}
          maxLength={LIMITS.titleMax}
          counterMax={LIMITS.titleMax}
          error={errors.title}
        />
        <TextField
          label={t('create.brief')}
          placeholder={t('create.briefPlaceholder')}
          value={f.brief}
          onChangeText={(v) => set('brief', v)}
          multiline
          maxLength={LIMITS.briefMax}
          counterMax={LIMITS.briefMax}
          error={errors.brief}
        />
        <Button
          variant="glass"
          label={aiBusy ? t('create.aiWorking') : t('create.ai')}
          icon={<Sparkles size={18} color={colors.accentText} />}
          disabled={aiBusy}
          onPress={compose}
        />
        {aiVersions.length > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Button
              variant="glass"
              size="icon"
              accessibilityLabel={t('create.aiPrev')}
              icon={<ChevronLeft size={18} color={colors.text} />}
              disabled={aiIdx === 0}
              onPress={() => {
                setAiIdx(aiIdx - 1);
                applyAi(aiVersions[aiIdx - 1]!);
              }}
            />
            <AppText variant="callout" tabular>
              {t('create.aiVersion', { n: aiIdx + 1, m: aiVersions.length })}
            </AppText>
            <Button
              variant="glass"
              size="icon"
              accessibilityLabel={t('create.aiNext')}
              icon={<ChevronRight size={18} color={colors.text} />}
              disabled={aiIdx === aiVersions.length - 1}
              onPress={() => {
                setAiIdx(aiIdx + 1);
                applyAi(aiVersions[aiIdx + 1]!);
              }}
            />
          </View>
        )}
        <TextField
          label={t('create.description')}
          placeholder={t('create.descriptionPlaceholder')}
          value={f.description}
          onChangeText={(v) => set('description', v)}
          multiline
          maxLength={4000}
        />
        <Label>{t('create.category')}</Label>
        <Row>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(`category.${c}`)}
              selected={f.category === c}
              onPress={() => set('category', c)}
            />
          ))}
        </Row>
        {fieldError('category')}
        <Label>{t('create.resultFormat')}</Label>
        <Row>
          {RESULT_FORMATS.map((x) => (
            <Chip
              key={x}
              label={t(`format.${x}`)}
              selected={f.resultFormat === x}
              onPress={() => set('resultFormat', x)}
            />
          ))}
        </Row>
        {fieldError('resultFormat')}
      </Block>

      <Block n={2} title={t('create.block2')}>
        <SectionTitle>{t('create.checklist')}</SectionTitle>
        <AppText variant="callout" color="textSecondary">
          {t('create.checklistHint')}
        </AppText>
        {f.checklist.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={`${i + 1}.`}
                placeholder={t('create.checklistPlaceholder')}
                value={item}
                maxLength={200}
                onChangeText={(v) =>
                  set(
                    'checklist',
                    f.checklist.map((c, j) => (j === i ? v : c)),
                  )
                }
              />
            </View>
            <Button
              variant="glass"
              size="icon"
              accessibilityLabel={t('common.remove')}
              icon={<Trash2 size={18} color={colors.text} />}
              onPress={() =>
                set(
                  'checklist',
                  f.checklist.filter((_, j) => j !== i),
                )
              }
            />
          </View>
        ))}
        {f.checklist.length < 10 && (
          <Button
            variant="glass"
            label={t('create.checklistAdd')}
            icon={<Plus size={18} color={colors.text} />}
            onPress={() => set('checklist', [...f.checklist, ''])}
          />
        )}
        <Label>{t('create.deadline')}</Label>
        <Row>
          {DEADLINES.map((d) => (
            <Chip
              key={d}
              label={t(`deadline.${d}`)}
              selected={f.deadline === d}
              onPress={() => set('deadline', d)}
            />
          ))}
        </Row>
        {f.kind === 'nearby' && (
          <>
            <SectionTitle>{t('create.location')}</SectionTitle>
            <Button
              variant="glass"
              label={geo.state === 'locating' ? t('feed.geoLocating') : t('create.useMyLocation')}
              icon={<MapPin size={18} color={colors.text} />}
              disabled={geo.state === 'locating'}
              onPress={() => void geo.locate()}
            />
            {geo.coords && (
              <AppText variant="callout" color="textSecondary" tabular>
                {t('create.locationSet', {
                  lat: geo.coords.lat.toFixed(5),
                  lng: geo.coords.lng.toFixed(5),
                })}
              </AppText>
            )}
            {(geo.state === 'denied' || geo.state === 'unavailable') && (
              <AppText variant="callout" color="danger">
                {t('feed.geoDenied')}
              </AppText>
            )}
            {fieldError('lat')}
            <Label>{t('create.radius')}</Label>
            <Row>
              {NEARBY_RADII_M.map((r) => (
                <Chip
                  key={r}
                  label={formatDistance(r)}
                  selected={f.radiusM === r}
                  onPress={() => set('radiusM', r)}
                />
              ))}
            </Row>
            <TextField
              label={t('create.placeName')}
              value={f.placeName}
              onChangeText={(v) => set('placeName', v)}
              maxLength={120}
            />
            <Label>{t('create.proofsTitle')}</Label>
            <Row>
              {PROOFS.map((p) => (
                <Chip
                  key={p}
                  label={t(`create.proofs.${p}`)}
                  selected={f.proofs.includes(p)}
                  onPress={() =>
                    set(
                      'proofs',
                      f.proofs.includes(p) ? f.proofs.filter((x) => x !== p) : [...f.proofs, p],
                    )
                  }
                />
              ))}
            </Row>
          </>
        )}
        {f.kind === 'campus' && (
          <TextField
            label={t('create.building')}
            value={f.building}
            onChangeText={(v) => set('building', v)}
            maxLength={120}
          />
        )}
        {f.kind !== 'online' && (
          <TextField
            label={t('create.visitWindow')}
            placeholder={t('create.visitWindowPlaceholder')}
            value={f.visitWindow}
            onChangeText={(v) => set('visitWindow', v)}
            maxLength={120}
          />
        )}
        <Label>{t('create.language')}</Label>
        <Row>
          <Chip
            label={t('create.anyLanguage')}
            selected={!f.language}
            onPress={() => set('language', '')}
          />
          {WORK_LANGUAGES.slice(0, 8).map((l) => (
            <Chip
              key={l}
              label={languageName(l)}
              selected={f.language === l}
              onPress={() => set('language', l)}
            />
          ))}
        </Row>
        <Label>{t('create.level')}</Label>
        <Row>
          <Chip label={t('create.anyLevel')} selected={!f.level} onPress={() => set('level', '')} />
          {EXPERIENCE_LEVELS.map((l) => (
            <Chip
              key={l}
              label={t(`onb.exp.${l}`)}
              selected={f.level === l}
              onPress={() => set('level', l)}
            />
          ))}
        </Row>
        {skillsForCategory.length > 0 && (
          <>
            <Label>{t('create.skills')}</Label>
            <Row>
              {skillsForCategory.map((s) => (
                <Chip
                  key={s}
                  label={t(`skill.${s}` as TranslationKey)}
                  selected={f.skills.includes(s)}
                  onPress={() =>
                    set(
                      'skills',
                      f.skills.includes(s)
                        ? f.skills.filter((x) => x !== s)
                        : [...f.skills, s].slice(0, 10),
                    )
                  }
                />
              ))}
            </Row>
          </>
        )}
        <Label>{t('create.attachments')}</Label>
        <FilePicker list={files} onChange={setFiles} />
      </Block>

      <Block n={3} title={t('create.block3')}>
        <Segmented
          value={f.inputCurrency}
          onChange={(c) => set('inputCurrency', c)}
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'RUB', label: 'RUB' },
            { value: 'USDT', label: 'USDT' },
          ]}
        />
        <TextField
          label={`${t('create.reward')} · ${f.inputCurrency}`}
          value={f.reward}
          onChangeText={(v) => set('reward', v)}
          keyboardType="decimal-pad"
          placeholder={f.inputCurrency === 'RUB' ? '2500' : '25'}
          hint={t('create.rewardHint')}
          error={errors.rewardCents}
        />
        {f.inputCurrency === 'RUB' ? (
          rub ? (
            <AppText variant="callout" color="textSecondary">
              {t('create.rubHint', {
                rate: rub.per_usd.toFixed(2),
                date: formatDateTime(rub.fetched_at),
              })}
              {rewardCents ? `\n${t('create.rubEquals', { v: formatMoney(rewardCents) })}` : ''}
            </AppText>
          ) : (
            <AppText variant="callout" color="danger">
              {t('create.noRate')}
            </AppText>
          )
        ) : null}
        {f.inputCurrency === 'USDT' && (
          <AppText variant="callout" color="textSecondary">
            {t('create.usdtHint')}
          </AppText>
        )}
        <ListGroup>
          <ListRow title={t('create.reward')} value={fmt(price?.reward ?? 0)} />
          <ListRow
            title={`${t('create.fee')}${price ? ` · ${formatBps(price.feeBps)}` : ''}`}
            value={fmt(price?.fee ?? 0)}
          />
          <ListRow title={t('create.balanceIn', { c: paidIn })} value={fmt(available)} />
        </ListGroup>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <AppText variant="title3">{t('create.total')}</AppText>
          <AppText variant="price" color="accentText" tabular testID="total">
            {fmt(price?.total ?? 0)}
          </AppText>
        </View>
        <AppText variant="callout" color="textSecondary">
          {t('fees.rule')}
        </AppText>
        <AppText variant="callout" color="textSecondary">
          {t('create.safeHint')}
        </AppText>
        {shortBy > 0 && (
          <AppText
            variant="callout"
            color="warning"
            accessibilityRole="alert"
            style={{ fontFamily: familyByWeight['600'] }}
          >
            {t('create.notEnough', { v: fmt(shortBy) })}
          </AppText>
        )}
      </Block>

      <Block n={4} title={t('create.block4')}>
        <TaskCard
          task={{
            id: 'preview',
            title: f.title.trim() || t('create.namePlaceholder'),
            rewardCents: rewardCents ?? 0,
            kind: f.kind,
            category: f.category ?? 'other',
            deadline: f.deadline,
            campusName: f.kind === 'campus' ? uniName : undefined,
          }}
          footer={f.description || f.brief || undefined}
        />
        <FormError error={formError} />
        <Button
          size="lg"
          block
          label={t('create.publish', { v: fmt(price?.total ?? 0) })}
          disabled={busy || shortBy > 0 || (f.inputCurrency === 'RUB' && !rub)}
          onPress={() => void publish()}
        />
        <Button
          variant="glass"
          block
          label={t('create.saveDraft')}
          disabled={!f.title.trim()}
          onPress={saveDraft}
        />
      </Block>
    </Screen>
  );
}
