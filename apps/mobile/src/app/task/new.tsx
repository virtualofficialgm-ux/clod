import {
  CATEGORIES,
  DEADLINES,
  LIMITS,
  NEARBY_RADII_M,
  RESULT_FORMATS,
  fieldErrors,
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
  type ResultFormat,
  type TaskKind,
} from '@parri/shared';
import { keys, useMe, useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MapPin, Plus, Sparkles, Trash2 } from '@/components/icons';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { FilePicker, uploadPicked } from '@/components/task/Sheets';
import { TaskCard } from '@/components/task/TaskCard';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField, errorText } from '@/components/ui/TextField';
import { Card, Label, PageTitle, Row, SectionTitle, useToast } from '@/components/ui/bits';
import type { PickedFile } from '@/lib/files';
import { MAX_FILE_BYTES } from '@/lib/files';
import { useDeviceLocation } from '@/lib/location';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

function uuid(): string {
  // RFC 4122 v4 без зависимостей (crypto.randomUUID есть не во всех движках RN)
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function NewTask() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const { colors } = useTheme();
  const me = useMe();
  const geo = useDeviceLocation();
  const [kind, setKind] = useState<TaskKind>('online');
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [resultFormat, setResultFormat] = useState<ResultFormat | null>(null);
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [deadline, setDeadline] = useState<Deadline>('24h');
  const [radiusM, setRadiusM] = useState(250);
  const [placeName, setPlaceName] = useState('');
  const [reward, setReward] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
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
    if (title.trim().length < 3 || !brief.trim()) return setFormError('create.aiNeedInput');
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
    const parsed = taskDraftSchema.safeParse({
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
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return setFormError('errors.check_failed');
    }
    if (files.some((f) => f.size > MAX_FILE_BYTES)) return setFormError('errors.file_too_big');
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const id = uuid();
      const refs = await uploadPicked(sb, me.data!.profile.id, id, 'brief', files);
      await tasks.publish(sb, id, parsed.data, refs);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: ['my-tasks'] })]);
      toast(t('create.published'));
      router.replace(`/task/${id}`);
    } catch (e) {
      setFormError(toApiError(e).key);
      setBusy(false);
    }
  };

  const fieldError = (k: string) =>
    errors[k] ? (
      <AppText variant="callout" style={{ color: colors.danger, fontFamily: familyByWeight['600'] }}>
        {errorText(errors[k])}
      </AppText>
    ) : null;

  return (
    <Screen title={t('create.title')} leading={<BackButton />}>
      <PageTitle>{t('create.title')}</PageTitle>
      <View style={{ gap: 10 }}>
        <SectionTitle>{t('create.kind')}</SectionTitle>
        <Segmented
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
          <AppText variant="callout" style={{ color: uniName ? colors.textSecondary : colors.danger }}>
            {uniName ? t('create.campusFor', { name: uniName }) : t('errors.university_required')}
          </AppText>
        )}
      </View>

      <Card>
        <TextField label={t('create.name')} placeholder={t('create.namePlaceholder')} value={title} onChangeText={setTitle} maxLength={LIMITS.titleMax} counterMax={LIMITS.titleMax} error={errors.title} />
        <TextField label={t('create.brief')} placeholder={t('create.briefPlaceholder')} value={brief} onChangeText={setBrief} multiline maxLength={LIMITS.briefMax} counterMax={LIMITS.briefMax} error={errors.brief} />
        <Button
          variant="glass"
          label={aiBusy ? t('create.aiWorking') : t('create.ai')}
          icon={<Sparkles size={18} strokeWidth={2.4} color={colors.accentText} />}
          disabled={aiBusy}
          onPress={compose}
        />
        <TextField label={t('create.description')} placeholder={t('create.descriptionPlaceholder')} value={description} onChangeText={setDescription} multiline maxLength={4000} />
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle>{t('create.category')}</SectionTitle>
        <Row>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={t(`category.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </Row>
        {fieldError('category')}
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle>{t('create.resultFormat')}</SectionTitle>
        <Row>
          {RESULT_FORMATS.map((f) => (
            <Chip key={f} label={t(`format.${f}`)} selected={resultFormat === f} onPress={() => setResultFormat(f)} />
          ))}
        </Row>
        {fieldError('resultFormat')}
      </View>

      <Card>
        <SectionTitle>{t('create.checklist')}</SectionTitle>
        <AppText variant="callout" color="textSecondary">
          {t('create.checklistHint')}
        </AppText>
        {checklist.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField label={`${i + 1}.`} placeholder={t('create.checklistPlaceholder')} value={item} maxLength={200} onChangeText={(v) => setChecklist(checklist.map((c, j) => (j === i ? v : c)))} />
            </View>
            <Button variant="glass" size="icon" accessibilityLabel={t('common.remove')} icon={<Trash2 size={18} color={colors.text} />} onPress={() => setChecklist(checklist.filter((_, j) => j !== i))} />
          </View>
        ))}
        {checklist.length < 10 && <Button variant="glass" label={t('create.checklistAdd')} icon={<Plus size={18} color={colors.text} />} onPress={() => setChecklist([...checklist, ''])} />}
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle>{t('create.deadline')}</SectionTitle>
        <Row>
          {DEADLINES.map((d) => (
            <Chip key={d} label={t(`deadline.${d}`)} selected={deadline === d} onPress={() => setDeadline(d)} />
          ))}
        </Row>
      </View>

      {kind === 'nearby' && (
        <Card>
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
              {t('create.locationSet', { lat: geo.coords.lat.toFixed(5), lng: geo.coords.lng.toFixed(5) })}
            </AppText>
          )}
          {(geo.state === 'denied' || geo.state === 'unavailable') && (
            <AppText variant="callout" style={{ color: colors.danger }}>
              {t('feed.geoDenied')}
            </AppText>
          )}
          {fieldError('lat')}
          <Label>{t('create.radius')}</Label>
          <Row>
            {NEARBY_RADII_M.map((r) => (
              <Chip key={r} label={formatDistance(r)} selected={radiusM === r} onPress={() => setRadiusM(r)} />
            ))}
          </Row>
          <TextField label={t('create.placeName')} value={placeName} onChangeText={setPlaceName} maxLength={120} />
        </Card>
      )}

      <View style={{ gap: 10 }}>
        <SectionTitle>{t('create.attachments')}</SectionTitle>
        <FilePicker list={files} onChange={setFiles} />
      </View>

      <Card>
        <SectionTitle>{t('create.budgetTitle')}</SectionTitle>
        <TextField label={t('create.reward')} value={reward} onChangeText={setReward} keyboardType="decimal-pad" placeholder="25" hint={t('create.rewardHint')} error={errors.rewardCents} />
        {[
          [t('create.reward'), formatMoney(price?.reward ?? 0)],
          [t('create.fee'), formatMoney(price?.fee ?? 0)],
        ].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body" color="textSecondary">
              {k}
            </AppText>
            <AppText variant="bodyStrong" tabular>
              {v}
            </AppText>
          </View>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: colors.separator, paddingTop: 12 }}>
          <AppText variant="title3">{t('create.total')}</AppText>
          <AppText variant="price" color="accentText" tabular testID="total">
            {formatMoney(price?.total ?? 0)}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="body" color="textSecondary">
            {t('create.balance')}
          </AppText>
          <AppText variant="bodyStrong" tabular>
            {formatMoney(available)}
          </AppText>
        </View>
        <AppText variant="callout" color="textSecondary">
          {t('fees.rule')}
        </AppText>
        <AppText variant="callout" color="textSecondary">
          {t('create.safeHint')}
        </AppText>
        {shortBy > 0 && (
          <AppText variant="callout" accessibilityRole="alert" style={{ color: colors.warning, fontFamily: familyByWeight['600'] }}>
            {t('create.notEnough', { v: formatMoney(shortBy) })}
          </AppText>
        )}
      </Card>

      <View style={{ gap: 10 }}>
        <AppText variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }}>
          {t('create.preview')}
        </AppText>
        <TaskCard
          task={{
            id: 'preview',
            title: title.trim() || t('create.namePlaceholder'),
            rewardCents: rewardCents ?? 0,
            kind,
            category: category ?? 'other',
            deadline,
            campusName: kind === 'campus' ? uniName : undefined,
          }}
          footer={description || brief || undefined}
        />
      </View>

      <FormError error={formError} />
      <Button size="lg" block label={t('create.publish', { v: formatMoney(price?.total ?? 0) })} disabled={busy || shortBy > 0} onPress={publish} />
    </Screen>
  );
}
