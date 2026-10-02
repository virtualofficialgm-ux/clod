import {
  bioSchema,
  profile as profileApi,
  t,
  toApiError,
  usernameSchema,
  type PortfolioItem,
  type Profile,
  type ProfileData,
  type ProfileLink,
  type TranslationKey,
} from '@parri/shared';
import { keys, useMe, useSkills, useSupabase } from '@parri/shared/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Center, Label, PageTitle, Row, useToast } from '@/components/ui/bits';
import { Card, CardHeader } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

type SkillRow = { slug: string; level: string };
interface Form {
  display_name: string;
  username: string;
  headline: string;
  bio: string;
  city: string;
  platform_role: Profile['platform_role'];
  availability: Profile['availability'];
  response_time: Profile['response_time'];
  links: ProfileLink[];
  hidden_fields: string[];
  skills: SkillRow[];
}
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;

export default function AccountEdit() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const { colors } = useTheme();
  const me = useMe();
  const catalog = useSkills().data ?? [];
  const uid = me.data?.profile.id;
  const mySkills = useQuery({
    queryKey: ['my-skills', uid],
    queryFn: () => profileApi.mySkills(sb, uid!),
    enabled: !!uid,
  });
  const portfolio = useQuery({
    queryKey: ['portfolio', uid],
    queryFn: () => profileApi.portfolio(sb, uid!),
    enabled: !!uid,
  });
  const [f, setF] = useState<Form | null>(null);
  const initial = useRef('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const [work, setWork] = useState({
    title: '',
    url: '',
    visibility: 'public' as PortfolioItem['visibility'],
  });

  useEffect(() => {
    if (f || !me.data || !mySkills.data) return;
    const p = me.data.profile;
    const v: Form = {
      display_name: p.display_name ?? '',
      username: p.username ?? '',
      headline: p.headline ?? '',
      bio: p.bio ?? '',
      city: p.city ?? '',
      platform_role: p.platform_role,
      availability: p.availability,
      response_time: p.response_time,
      links: p.links,
      hidden_fields: p.hidden_fields,
      skills: mySkills.data.map((s) => ({ slug: s.skill_slug, level: s.level ?? '' })),
    };
    initial.current = JSON.stringify(v);
    setF(v);
  }, [f, me.data, mySkills.data]);

  const options = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q || !f) return [];
    return catalog
      .filter(
        (s) =>
          !f.skills.some((x) => x.slug === s.slug) &&
          t(`skill.${s.slug}` as TranslationKey)
            .toLowerCase()
            .includes(q),
      )
      .slice(0, 8);
  }, [skillQuery, catalog, f]);

  if (!f || !me.data)
    return (
      <Screen title={t('editProfile.title')} leading={<BackButton />}>
        <Center />
      </Screen>
    );
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => (s ? { ...s, [k]: v } : s));
  const dirty = JSON.stringify(f) !== initial.current;
  const p = me.data.profile;
  const showPublic = (field: string) => (
    <Checkbox
      checked={!f.hidden_fields.includes(field)}
      onChange={(on) =>
        set(
          'hidden_fields',
          on ? f.hidden_fields.filter((x) => x !== field) : [...f.hidden_fields, field],
        )
      }
      label={t('editProfile.showPublic')}
    />
  );
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= f.skills.length) return;
    const next = [...f.skills];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set('skills', next);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    const u = usernameSchema.safeParse(f.username);
    if (f.username && !u.success) errs.username = u.error.issues[0]!.message;
    const b = bioSchema.safeParse(f.bio);
    if (!b.success) errs.bio = b.error.issues[0]!.message;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const data: ProfileData = {
      display_name: f.display_name.trim() || undefined,
      ...(f.username && f.username !== p.username ? { username: u.data } : {}),
      headline: f.headline.trim() || null,
      bio: f.bio.trim() || null,
      city: f.city.trim() || null,
      platform_role: f.platform_role,
      availability: f.availability,
      response_time: f.response_time,
      links: f.links.filter((l) => l.url.trim()),
      hidden_fields: f.hidden_fields,
      skills: f.skills.map((s) => s.slug),
      skill_levels: Object.fromEntries(
        f.skills.filter((s) => s.level).map((s) => [s.slug, s.level]),
      ),
    };
    setBusy(true);
    setFormError(null);
    try {
      await profileApi.saveData(sb, data);
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.me }),
        qc.invalidateQueries({ queryKey: ['my-skills'] }),
        qc.invalidateQueries({ queryKey: ['profile'] }),
      ]);
      initial.current = JSON.stringify(f);
      toast(t('editProfile.saved'));
    } catch (e) {
      setFormError(toApiError(e).key);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={t('editProfile.title')}
      leading={<BackButton />}
      footer={
        <View style={{ gap: 6 }}>
          {dirty ? (
            <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {t('editProfile.unsaved')}
            </AppText>
          ) : null}
          <FormError error={formError} />
          <Button
            size="lg"
            block
            label={t('editProfile.save')}
            disabled={busy || !dirty}
            onPress={save}
          />
        </View>
      }
    >
      <PageTitle>{t('editProfile.title')}</PageTitle>
      <Card>
        <CardHeader title={t('editProfile.sectionMain')} />
        <TextField
          label={t('editProfile.displayName')}
          value={f.display_name}
          onChangeText={(v) => set('display_name', v)}
          maxLength={60}
        />
        <TextField
          label={t('editProfile.username')}
          value={f.username}
          onChangeText={(v) => set('username', v.toLowerCase())}
          autoCapitalize="none"
          error={errors.username}
          maxLength={30}
        />
        <TextField
          label={t('editProfile.headline')}
          placeholder={t('editProfile.headlinePlaceholder')}
          value={f.headline}
          onChangeText={(v) => set('headline', v)}
          maxLength={80}
        />
        <TextField
          label={t('editProfile.bio')}
          placeholder={t('editProfile.bioPlaceholder')}
          value={f.bio}
          onChangeText={(v) => set('bio', v)}
          multiline
          counterMax={1000}
          maxLength={1000}
          error={errors.bio}
        />
        {showPublic('bio')}
        <TextField
          label={t('editProfile.city')}
          value={f.city}
          onChangeText={(v) => set('city', v)}
          maxLength={80}
        />
        {showPublic('city')}
      </Card>
      <Card>
        <CardHeader title={t('editProfile.sectionWork')} />
        <Label>{t('editProfile.role')}</Label>
        <Segmented
          value={f.platform_role}
          onChange={(v) => set('platform_role', v)}
          options={(['executor', 'customer', 'both'] as const).map((v) => ({
            value: v,
            label: t(`profile.role.${v}`),
          }))}
        />
        <Label>{t('editProfile.status')}</Label>
        <Segmented
          value={f.availability}
          onChange={(v) => set('availability', v)}
          options={(['available', 'busy', 'hidden'] as const).map((v) => ({
            value: v,
            label: t(`people.availability.${v}`),
          }))}
        />
        <Label>{t('editProfile.responseTime')}</Label>
        <Row>
          {(['5m', '1h', '3h', 'day'] as const).map((v) => (
            <Chip
              key={v}
              label={t(`profile.rt.${v}`)}
              selected={f.response_time === v}
              onPress={() => set('response_time', v)}
            />
          ))}
        </Row>
      </Card>
      <Card testID="edit-skills">
        <CardHeader
          title={`${t('editProfile.skillsTitle')} · ${t('editProfile.skillsCount', { n: f.skills.length })}`}
        />
        {f.skills.map((s, i) => (
          <View key={s.slug} style={{ gap: 6, paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {t(`skill.${s.slug}` as TranslationKey)}
              </AppText>
              <Button
                variant="glass"
                size="icon"
                accessibilityLabel={t('editProfile.moveUp')}
                icon={<ArrowUp size={16} color={colors.text} />}
                disabled={i === 0}
                onPress={() => move(i, -1)}
              />
              <Button
                variant="glass"
                size="icon"
                accessibilityLabel={t('editProfile.moveDown')}
                icon={<ArrowDown size={16} color={colors.text} />}
                disabled={i === f.skills.length - 1}
                onPress={() => move(i, 1)}
              />
              <Button
                variant="glass"
                size="icon"
                accessibilityLabel={t('common.remove')}
                icon={<X size={16} color={colors.text} />}
                onPress={() =>
                  set(
                    'skills',
                    f.skills.filter((_, j) => j !== i),
                  )
                }
              />
            </View>
            <Row>
              {LEVELS.map((l) => (
                <Chip
                  key={l}
                  label={l.toUpperCase()}
                  selected={s.level === l}
                  onPress={() =>
                    set(
                      'skills',
                      f.skills.map((x, j) =>
                        j === i ? { ...x, level: x.level === l ? '' : l } : x,
                      ),
                    )
                  }
                />
              ))}
            </Row>
          </View>
        ))}
        {f.skills.length < 30 ? (
          <TextField
            label={t('editProfile.findSkill')}
            value={skillQuery}
            onChangeText={setSkillQuery}
          />
        ) : null}
        {options.length ? (
          <Row>
            {options.map((s) => (
              <Chip
                key={s.slug}
                label={`+ ${t(`skill.${s.slug}` as TranslationKey)}`}
                onPress={() => {
                  set('skills', [...f.skills, { slug: s.slug, level: '' }]);
                  setSkillQuery('');
                }}
              />
            ))}
          </Row>
        ) : null}
      </Card>
      <Card>
        <CardHeader title={t('editProfile.sectionPortfolio')} />
        {(portfolio.data ?? []).map((w) => (
          <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{w.title}</AppText>
              <AppText variant="caption" color="textSecondary">
                {t(`editProfile.visibility.${w.visibility}`)}
              </AppText>
            </View>
            <Button
              variant="glass"
              size="icon"
              accessibilityLabel={t('editProfile.removeWork')}
              icon={<Trash2 size={16} color={colors.text} />}
              onPress={async () => {
                await profileApi.removePortfolio(sb, w.id);
                await qc.invalidateQueries({ queryKey: ['portfolio', uid] });
              }}
            />
          </View>
        ))}
        <TextField
          label={t('editProfile.workTitle')}
          value={work.title}
          onChangeText={(v) => setWork((s) => ({ ...s, title: v }))}
        />
        <TextField
          label={t('editProfile.workUrl')}
          value={work.url}
          onChangeText={(v) => setWork((s) => ({ ...s, url: v }))}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Segmented
          value={work.visibility}
          onChange={(v) => setWork((s) => ({ ...s, visibility: v }))}
          options={(['public', 'clients', 'private'] as const).map((v) => ({
            value: v,
            label: t(`editProfile.visibility.${v}`),
          }))}
        />
        <Button
          variant="glass"
          icon={<Plus size={16} color={colors.text} />}
          label={t('editProfile.addWork')}
          disabled={!work.title.trim()}
          onPress={async () => {
            try {
              await profileApi.addPortfolio(sb, {
                title: work.title.trim(),
                url: work.url.trim() || null,
                file_path: null,
                category: null,
                visibility: work.visibility,
              });
              setWork({ title: '', url: '', visibility: 'public' });
              await qc.invalidateQueries({ queryKey: ['portfolio', uid] });
            } catch (e) {
              setFormError(toApiError(e).key);
            }
          }}
        />
      </Card>
      <Card>
        <CardHeader title={t('editProfile.links')} />
        {f.links.map((l, i) => (
          <View key={i} style={{ gap: 6 }}>
            <TextField
              label={t('onb.linkTitle')}
              value={l.title}
              onChangeText={(v) =>
                set(
                  'links',
                  f.links.map((x, j) => (j === i ? { ...x, title: v } : x)),
                )
              }
              maxLength={60}
            />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('onb.linkUrl')}
                  value={l.url}
                  autoCapitalize="none"
                  keyboardType="url"
                  onChangeText={(v) =>
                    set(
                      'links',
                      f.links.map((x, j) => (j === i ? { ...x, url: v } : x)),
                    )
                  }
                />
              </View>
              <Button
                variant="glass"
                size="icon"
                accessibilityLabel={t('common.remove')}
                icon={<Trash2 size={16} color={colors.text} />}
                onPress={() =>
                  set(
                    'links',
                    f.links.filter((_, j) => j !== i),
                  )
                }
              />
            </View>
          </View>
        ))}
        {f.links.length < 10 ? (
          <Button
            variant="glass"
            icon={<Plus size={16} color={colors.text} />}
            label={t('editProfile.addLink')}
            onPress={() => set('links', [...f.links, { title: '', url: '' }])}
          />
        ) : null}
        {showPublic('links')}
      </Card>
    </Screen>
  );
}
