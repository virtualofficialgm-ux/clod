'use client';

import {
  CATEGORIES,
  COUNTRY_CODES,
  LANGUAGE_LEVELS,
  WORK_LANGUAGES,
  bioSchema,
  countryName,
  files,
  languageName,
  profile as profileApi,
  shortName,
  t,
  toApiError,
  usernameSchema,
  type Category,
  type Experience,
  type PortfolioItem,
  type Profile,
  type ProfileData,
  type ProfileLink,
  type TaskKind,
  type TranslationKey,
  type WorkLanguage,
} from '@parri/shared';
import { keys, useMe, useSkills, useSupabase } from '@parri/shared/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Camera, ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { Checkbox, FormError, Input, Select, TextArea } from '@/components/ui/Field';
import { Avatar, CenterSpinner, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

type SkillRow = { slug: string; level: string };
type Exp = Pick<Experience, 'company' | 'position' | 'from_year' | 'to_year'>;
type Hideable = 'bio' | 'city' | 'languages' | 'links' | 'experience';

interface Form {
  display_name: string;
  username: string;
  headline: string;
  bio: string;
  country_code: string;
  city: string;
  languages: WorkLanguage[];
  platform_role: Profile['platform_role'];
  availability: Profile['availability'];
  preferred_kinds: TaskKind[];
  response_time: Profile['response_time'];
  links: ProfileLink[];
  hidden_fields: string[];
  skills: SkillRow[];
  experience: Exp[];
}

function ShowPublic({ field, f, set }: { field: Hideable; f: Form; set: (v: string[]) => void }) {
  const shown = !f.hidden_fields.includes(field);
  return (
    <Checkbox
      checked={shown}
      onChange={(on) =>
        set(on ? f.hidden_fields.filter((x) => x !== field) : [...f.hidden_fields, field])
      }
    >
      {t('editProfile.showPublic')}
    </Checkbox>
  );
}

function Portfolio({ profileId }: { profileId: string }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['portfolio', profileId],
    queryFn: () => profileApi.portfolio(sb, profileId),
  });
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [visibility, setVisibility] = useState<PortfolioItem['visibility']>('public');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['portfolio', profileId] });
  return (
    <Card id="portfolio">
      <CardHeader title={t('editProfile.sectionPortfolio')} />
      <ul className="flex flex-col gap-2">
        {(list.data ?? []).map((w) => (
          <li key={w.id} className="tile flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{w.title}</span>
              <span className="block truncate text-caption text-text-2">
                {t(`editProfile.visibility.${w.visibility}`)}
                {w.url ? ` · ${w.url}` : ''}
              </span>
            </span>
            <Button
              variant="plain"
              size="icon"
              aria-label={t('editProfile.removeWork')}
              onClick={async () => {
                await profileApi.removePortfolio(sb, w.id);
                await refresh();
              }}
            >
              <Trash2 size={16} />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input
          label={t('editProfile.workTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Input
          label={t('editProfile.workUrl')}
          type="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Select
          label={t('editProfile.category')}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | '')}
          placeholder="—"
          options={CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`) }))}
        />
        <Select
          label={t('editProfile.showPublic')}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as PortfolioItem['visibility'])}
          options={(['public', 'clients', 'private'] as const).map((v) => ({
            value: v,
            label: t(`editProfile.visibility.${v}`),
          }))}
        />
      </div>
      <FormError error={error} />
      <div className="mt-3">
        <Button
          variant="glass"
          disabled={!title.trim()}
          onClick={async () => {
            try {
              await profileApi.addPortfolio(sb, {
                title: title.trim(),
                url: url.trim() || null,
                file_path: null,
                category: category || null,
                visibility,
              });
              setTitle('');
              setUrl('');
              setError(null);
              await refresh();
            } catch (e) {
              setError(toApiError(e).key);
            }
          }}
        >
          <Plus size={18} /> {t('editProfile.addWork')}
        </Button>
      </div>
    </Card>
  );
}

export default function EditProfilePage() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const catalog = useSkills().data ?? [];
  const uid = me.data?.profile.id;
  const mySkills = useQuery({
    queryKey: ['my-skills', uid],
    queryFn: () => profileApi.mySkills(sb, uid!),
    enabled: !!uid,
  });
  const myExp = useQuery({
    queryKey: ['my-exp', uid],
    queryFn: () => profileApi.experience(sb, uid!),
    enabled: !!uid,
  });
  const [f, setF] = useState<Form | null>(null);
  const initial = useRef<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usernameFree, setUsernameFree] = useState<boolean | null>(null);
  const [skillQuery, setSkillQuery] = useState('');
  const [newLang, setNewLang] = useState('');

  useEffect(() => {
    if (f || !me.data || !mySkills.data || !myExp.data) return;
    const p = me.data.profile;
    const v: Form = {
      display_name: p.display_name ?? '',
      username: p.username ?? '',
      headline: p.headline ?? '',
      bio: p.bio ?? '',
      country_code: p.country_code ?? '',
      city: p.city ?? '',
      languages: p.languages,
      platform_role: p.platform_role,
      availability: p.availability,
      preferred_kinds: p.preferred_kinds,
      response_time: p.response_time,
      links: p.links,
      hidden_fields: p.hidden_fields,
      skills: mySkills.data.map((s) => ({ slug: s.skill_slug, level: s.level ?? '' })),
      experience: myExp.data.map((e) => ({
        company: e.company,
        position: e.position,
        from_year: e.from_year,
        to_year: e.to_year,
      })),
    };
    initial.current = JSON.stringify(v);
    setF(v);
  }, [f, me.data, mySkills.data, myExp.data]);

  // Проверка занятости имени пользователя
  useEffect(() => {
    if (!f || f.username === (me.data?.profile.username ?? '')) return setUsernameFree(null);
    const parsed = usernameSchema.safeParse(f.username);
    if (!parsed.success) return setUsernameFree(null);
    const id = setTimeout(() => {
      profileApi
        .usernameAvailable(sb, parsed.data)
        .then(setUsernameFree)
        .catch(() => setUsernameFree(null));
    }, 400);
    return () => clearTimeout(id);
  }, [f?.username, f, me.data?.profile.username, sb]);

  const dirty = !!f && JSON.stringify(f) !== initial.current;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const skillOptions = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q || !f) return [];
    return catalog
      .filter((s) => !f.skills.some((x) => x.slug === s.slug))
      .filter(
        (s) =>
          t(`skill.${s.slug}` as TranslationKey)
            .toLowerCase()
            .includes(q) || s.slug.includes(q),
      )
      .slice(0, 8);
  }, [skillQuery, catalog, f]);

  if (!f || !me.data) return <CenterSpinner />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => (s ? { ...s, [k]: v } : s));
  const p = me.data.profile;
  const name = shortName(p.first_name, p.last_name);

  const save = async () => {
    const errs: Record<string, string> = {};
    const u = usernameSchema.safeParse(f.username);
    if (f.username && !u.success) errs.username = u.error.issues[0]!.message;
    if (usernameFree === false) errs.username = 'errors.username_taken';
    const b = bioSchema.safeParse(f.bio);
    if (!b.success) errs.bio = b.error.issues[0]!.message;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const data: ProfileData = {
      display_name: f.display_name.trim() || undefined,
      ...(f.username && f.username !== p.username ? { username: u.data } : {}),
      headline: f.headline.trim() || null,
      bio: f.bio.trim() || null,
      country_code: f.country_code || null,
      city: f.city.trim() || null,
      languages: f.languages,
      platform_role: f.platform_role,
      availability: f.availability,
      preferred_kinds: f.preferred_kinds,
      response_time: f.response_time,
      links: f.links.filter((l) => l.url.trim()),
      hidden_fields: f.hidden_fields,
      skills: f.skills.map((s) => s.slug),
      skill_levels: Object.fromEntries(
        f.skills.filter((s) => s.level).map((s) => [s.slug, s.level]),
      ),
      experience: f.experience.filter((e) => e.company.trim() && e.position.trim()),
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

  const moveSkill = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= f.skills.length) return;
    const next = [...f.skills];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set('skills', next);
  };

  return (
    <>
      <Header
        title={t('editProfile.title')}
        leading={
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.back')}
            onClick={() => router.push('/account')}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[860px] flex-col gap-5 px-[var(--p-gutter)] pb-32 pt-2 md:px-8">
        <PageTitle>{t('editProfile.title')}</PageTitle>

        <Card id="about" className="flex flex-col gap-4">
          <CardHeader title={t('editProfile.sectionMain')} />
          <div className="flex items-center gap-4">
            <Avatar name={name} url={p.avatar_url} size={80} />
            <label className="glass inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill px-5 text-callout font-bold">
              <Camera size={18} /> {t('editProfile.photo')}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const url = await files.uploadAvatar(sb, p.id, file, file.type || 'image/jpeg');
                    await profileApi.saveData(sb, { avatar_url: url });
                    await qc.invalidateQueries({ queryKey: keys.me });
                  } catch (err) {
                    setFormError(toApiError(err).key);
                  }
                }}
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t('editProfile.displayName')}
              value={f.display_name}
              onChange={(e) => set('display_name', e.target.value)}
              maxLength={60}
            />
            <Input
              label={t('editProfile.username')}
              value={f.username}
              onChange={(e) => set('username', e.target.value.toLowerCase())}
              error={errors.username}
              hint={
                usernameFree == null
                  ? undefined
                  : usernameFree
                    ? t('editProfile.usernameFree')
                    : t('editProfile.usernameTaken')
              }
              maxLength={30}
            />
          </div>
          <Input
            label={t('editProfile.headline')}
            placeholder={t('editProfile.headlinePlaceholder')}
            value={f.headline}
            onChange={(e) => set('headline', e.target.value)}
            maxLength={80}
          />
          <TextArea
            label={t('editProfile.bio')}
            placeholder={t('editProfile.bioPlaceholder')}
            value={f.bio}
            onChange={(e) => set('bio', e.target.value)}
            rows={5}
            counterMax={1000}
            maxLength={1000}
            error={errors.bio}
          />
          <ShowPublic field="bio" f={f} set={(v) => set('hidden_fields', v)} />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label={t('editProfile.country')}
              value={f.country_code}
              onChange={(e) => set('country_code', e.target.value)}
              placeholder="—"
              options={COUNTRY_CODES.map((c) => ({ value: c, label: countryName(c) }))}
            />
            <Input
              label={t('editProfile.city')}
              value={f.city}
              onChange={(e) => set('city', e.target.value)}
              maxLength={80}
            />
          </div>
          <ShowPublic field="city" f={f} set={(v) => set('hidden_fields', v)} />
        </Card>

        <Card className="flex flex-col gap-3">
          <CardHeader title={t('editProfile.languages')} />
          {f.languages.map((l, i) => (
            <div key={l.code} className="flex items-end gap-2">
              <span className="tile flex h-14 flex-1 items-center px-4 font-semibold">
                {languageName(l.code)}
              </span>
              <div className="w-40">
                <Select
                  label={t('editProfile.skillLevel')}
                  value={l.level}
                  onChange={(e) =>
                    set(
                      'languages',
                      f.languages.map((x, j) =>
                        j === i ? { ...x, level: e.target.value as WorkLanguage['level'] } : x,
                      ),
                    )
                  }
                  options={LANGUAGE_LEVELS.map((v) => ({ value: v, label: t(`onb.levels.${v}`) }))}
                />
              </div>
              <Button
                variant="glass"
                size="icon"
                aria-label={t('common.remove')}
                onClick={() =>
                  set(
                    'languages',
                    f.languages.filter((_, j) => j !== i),
                  )
                }
              >
                <X size={18} />
              </Button>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label={t('editProfile.addLanguage')}
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                placeholder="—"
                options={WORK_LANGUAGES.filter((c) => !f.languages.some((l) => l.code === c)).map(
                  (c) => ({ value: c, label: languageName(c) }),
                )}
              />
            </div>
            <Button
              variant="glass"
              disabled={!newLang || f.languages.length >= 10}
              onClick={() => {
                set('languages', [...f.languages, { code: newLang, level: 'b2' }]);
                setNewLang('');
              }}
            >
              <Plus size={18} /> {t('common.add')}
            </Button>
          </div>
          <ShowPublic field="languages" f={f} set={(v) => set('hidden_fields', v)} />
        </Card>

        <Card className="flex flex-col gap-4">
          <CardHeader title={t('editProfile.sectionWork')} />
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('editProfile.role')}</span>
            <Segmented
              label={t('editProfile.role')}
              value={f.platform_role}
              onChange={(v) => set('platform_role', v)}
              options={(['executor', 'customer', 'both'] as const).map((v) => ({
                value: v,
                label: t(`profile.role.${v}`),
              }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('editProfile.status')}</span>
            <Segmented
              label={t('editProfile.status')}
              value={f.availability}
              onChange={(v) => set('availability', v)}
              options={(['available', 'busy', 'hidden'] as const).map((v) => ({
                value: v,
                label: t(`people.availability.${v}`),
              }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('editProfile.kinds')}</span>
            <div className="flex flex-wrap gap-2">
              {(['online', 'nearby', 'campus'] as const).map((k) => (
                <Chip
                  key={k}
                  selected={f.preferred_kinds.includes(k)}
                  onClick={() =>
                    set(
                      'preferred_kinds',
                      f.preferred_kinds.includes(k)
                        ? f.preferred_kinds.filter((x) => x !== k)
                        : [...f.preferred_kinds, k],
                    )
                  }
                >
                  {t(`kind.${k}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('editProfile.responseTime')}</span>
            <div className="flex flex-wrap gap-2">
              {(['5m', '1h', '3h', 'day'] as const).map((v) => (
                <Chip
                  key={v}
                  selected={f.response_time === v}
                  onClick={() => set('response_time', v)}
                >
                  {t(`profile.rt.${v}`)}
                </Chip>
              ))}
            </div>
          </div>
        </Card>

        <Card id="skills" className="flex flex-col gap-3">
          <CardHeader
            title={`${t('editProfile.skillsTitle')} · ${t('editProfile.skillsCount', { n: f.skills.length })}`}
          />
          <ul className="flex flex-col gap-2" data-testid="edit-skills">
            {f.skills.map((s, i) => (
              <li key={s.slug} className="tile flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 font-semibold">
                  {t(`skill.${s.slug}` as TranslationKey)}
                </span>
                <select
                  aria-label={t('editProfile.skillLevel')}
                  value={s.level}
                  onChange={(e) =>
                    set(
                      'skills',
                      f.skills.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)),
                    )
                  }
                  className="h-9 rounded-pill bg-fill px-3 text-callout"
                >
                  <option value="">{t('editProfile.noLevel')}</option>
                  {(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const).map((v) => (
                    <option key={v} value={v}>
                      {t(`editProfile.levels.${v}`)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={t('editProfile.moveUp')}
                  onClick={() => moveSkill(i, -1)}
                  disabled={i === 0}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={t('editProfile.moveDown')}
                  onClick={() => moveSkill(i, 1)}
                  disabled={i === f.skills.length - 1}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={t('common.remove')}
                  onClick={() =>
                    set(
                      'skills',
                      f.skills.filter((_, j) => j !== i),
                    )
                  }
                >
                  <X size={16} />
                </Button>
              </li>
            ))}
          </ul>
          {f.skills.length < 30 && (
            <div className="relative">
              <Input
                label={t('editProfile.findSkill')}
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
              />
              {skillOptions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {skillOptions.map((s) => (
                    <Chip
                      key={s.slug}
                      onClick={() => {
                        set('skills', [...f.skills, { slug: s.slug, level: '' }]);
                        setSkillQuery('');
                      }}
                    >
                      + {t(`skill.${s.slug}` as TranslationKey)}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Portfolio profileId={p.id} />

        <Card id="experience" className="flex flex-col gap-3">
          <CardHeader title={t('editProfile.experienceTitle')} />
          {f.experience.map((e, i) => (
            <div key={i} className="grid items-end gap-2 md:grid-cols-[1fr_1fr_100px_100px_auto]">
              <Input
                label={t('onb.company')}
                value={e.company}
                onChange={(ev) =>
                  set(
                    'experience',
                    f.experience.map((x, j) => (j === i ? { ...x, company: ev.target.value } : x)),
                  )
                }
              />
              <Input
                label={t('onb.position')}
                value={e.position}
                onChange={(ev) =>
                  set(
                    'experience',
                    f.experience.map((x, j) => (j === i ? { ...x, position: ev.target.value } : x)),
                  )
                }
              />
              <Input
                label={t('onb.fromYear')}
                inputMode="numeric"
                value={e.from_year ?? ''}
                onChange={(ev) =>
                  set(
                    'experience',
                    f.experience.map((x, j) =>
                      j === i ? { ...x, from_year: Number(ev.target.value) || null } : x,
                    ),
                  )
                }
              />
              <Input
                label={t('onb.toYear')}
                inputMode="numeric"
                value={e.to_year ?? ''}
                onChange={(ev) =>
                  set(
                    'experience',
                    f.experience.map((x, j) =>
                      j === i ? { ...x, to_year: Number(ev.target.value) || null } : x,
                    ),
                  )
                }
              />
              <Button
                variant="glass"
                size="icon"
                aria-label={t('common.remove')}
                onClick={() =>
                  set(
                    'experience',
                    f.experience.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {f.experience.length < 10 && (
            <div>
              <Button
                variant="glass"
                onClick={() =>
                  set('experience', [
                    ...f.experience,
                    { company: '', position: '', from_year: null, to_year: null },
                  ])
                }
              >
                <Plus size={18} /> {t('editProfile.addExperience')}
              </Button>
            </div>
          )}
          <ShowPublic field="experience" f={f} set={(v) => set('hidden_fields', v)} />
        </Card>

        <Card id="links" className="flex flex-col gap-3">
          <CardHeader title={t('editProfile.links')} />
          {f.links.map((l, i) => (
            <div key={i} className="grid items-end gap-2 md:grid-cols-[1fr_2fr_auto]">
              <Input
                label={t('onb.linkTitle')}
                value={l.title}
                maxLength={60}
                onChange={(e) =>
                  set(
                    'links',
                    f.links.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                  )
                }
              />
              <Input
                label={t('onb.linkUrl')}
                type="url"
                value={l.url}
                onChange={(e) =>
                  set(
                    'links',
                    f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  )
                }
              />
              <Button
                variant="glass"
                size="icon"
                aria-label={t('common.remove')}
                onClick={() =>
                  set(
                    'links',
                    f.links.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {f.links.length < 10 && (
            <div>
              <Button
                variant="glass"
                onClick={() => set('links', [...f.links, { title: '', url: '' }])}
              >
                <Plus size={18} /> {t('editProfile.addLink')}
              </Button>
            </div>
          )}
          <ShowPublic field="links" f={f} set={(v) => set('hidden_fields', v)} />
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-[92px] z-30 px-[var(--p-gutter)] md:bottom-4 md:pl-[calc(var(--p-sidebar-width)+16px)]">
        <div className="glass mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 rounded-pill p-2 pl-5">
          <span className="text-callout font-semibold text-text-2">
            {dirty ? t('editProfile.unsaved') : ''}
          </span>
          <FormError error={formError} />
          <Button onClick={save} disabled={busy || !dirty}>
            {t('editProfile.save')}
          </Button>
        </div>
      </div>
    </>
  );
}
