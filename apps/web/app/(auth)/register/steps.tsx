'use client';

/**
 * Шаги регистрации в стиле Cal AI: один вопрос на экран, крупный заголовок, серые плитки,
 * большая кнопка «Продолжить» внизу. Каждый шаг сохраняется на сервере (save_profile_data).
 */
import {
  COUNTRY_CODES,
  DISPLAY_CURRENCIES,
  EXPERIENCE_LEVELS,
  LANGUAGE_LEVELS,
  LOCALES,
  LOCALE_NAMES,
  PROFESSIONS,
  SKILLS_MAX,
  SKILLS_MIN,
  WORK_LANGUAGES,
  auth,
  bioSchema,
  countryName,
  deviceTimezone,
  emailSchema,
  fieldErrors,
  files,
  formatMoney,
  languageName,
  otpSchema,
  passwordSchema,
  passwordStrength,
  personalStepSchema,
  profile,
  showcaseTasks,
  t,
  toApiError,
  type Category,
  type ExperienceLevel,
  type Me,
  type ProfileData,
  type ProfileLink,
  type TranslationKey,
  type WorkLanguage,
} from '@parri/shared';
import { keys, useFeed, useSkills, useSupabase, useUniversitySearch } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Briefcase, Camera, CheckCircle2, Eye, EyeOff, GraduationCap, Link2, Mail, Plus, Sparkles, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { TaskCard } from '@/components/task/TaskCard';
import { categoryIcon } from '@/components/task/categoryIcon';
import { Checkbox, FormError, Input, Select, TextArea } from '@/components/ui/Field';
import { OtpInput } from '@/components/ui/OtpInput';
import { AppleIcon, GoogleIcon } from '@/components/ui/BrandIcons';
import { Avatar } from '@/components/ui/bits';
import { springs } from '@/lib/springs';
import { ListGroup, ListRow, OptionTile, StepTitle, Toggle } from '@/components/ui/kit';
import { useCooldown } from '../useCooldown';

export interface StepProps {
  me: Me | null | undefined;
  next: () => void;
  goTo?: (step: StepId) => void;
}

export type StepId =
  | 'start'
  | 'email'
  | 'code'
  | 'password'
  | 'personal'
  | 'location'
  | 'profession'
  | 'skills'
  | 'about'
  | 'education'
  | 'security'
  | 'done';

// ---------- Общее ----------
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(toApiError(e).key);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Большая кнопка внизу экрана, как в Cal AI: на телефоне прилипает к низу */
function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-[var(--p-gutter)] mt-auto flex flex-col gap-2 bg-gradient-to-t from-[var(--p-background)] from-60% to-transparent px-[var(--p-gutter)] pb-[max(16px,env(safe-area-inset-bottom))] pt-6 md:static md:mx-0 md:bg-none md:px-0">
      {children}
    </div>
  );
}

function useSaveData(onDone: () => void) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const r = useRunner();
  const save = (data: ProfileData) =>
    r.run(async () => {
      await profile.saveData(sb, data);
      await qc.invalidateQueries({ queryKey: keys.me });
      onDone();
    });
  return { ...r, save };
}

// ---------- 0. Старт ----------
export function StartStep({ next }: StepProps) {
  const sb = useSupabase();
  const r = useRunner();
  const oauth = (provider: 'google' | 'apple') =>
    r.run(async () => {
      try {
        await auth.signInWithProvider(sb, provider, `${location.origin}/register`);
      } catch {
        throw new Error(t('errors.oauth_unavailable', { provider: provider === 'google' ? 'Google' : 'Apple' }));
      }
    });
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-3 pt-6">
        <h1 className="text-title1 font-extrabold">
          {t('onb.welcomeTitle')}
          <span className="text-accent">.</span>
        </h1>
        <p className="text-body text-text-2">{t('onb.welcomeText')}</p>
      </div>
      <HeroStack />
      <Footer>
        <Button variant="glass" size="lg" block onClick={() => oauth('google')} disabled={r.busy}>
          <GoogleIcon />
          {t('onb.google')}
        </Button>
        <Button variant="glass" size="lg" block onClick={() => oauth('apple')} disabled={r.busy}>
          <AppleIcon />
          {t('onb.apple')}
        </Button>
        <Button size="lg" block onClick={next}>
          <Mail size={20} strokeWidth={2.6} />
          {t('onb.email')}
        </Button>
        <FormError error={r.error} />
        <Link href="/login" className="py-2 text-center text-callout font-bold text-accent-text">
          {t('onb.haveAccount')}
        </Link>
      </Footer>
    </div>
  );
}

/** Веер из трёх карточек задач — визуал стартового экрана (как макет телефона у Cal AI) */
function HeroStack() {
  const reduce = useReducedMotion();
  const cards = showcaseTasks.slice(0, 3);
  const pose = [
    { rotate: -7, x: -18, y: 18 },
    { rotate: 5, x: 22, y: 6 },
    { rotate: -1, x: 0, y: -6 },
  ];
  return (
    <div aria-hidden className="relative mx-auto my-2 h-[230px] w-full max-w-[340px]">
      {cards.map((c, i) => {
        const Icon = categoryIcon(c.category);
        return (
          <motion.div
            key={c.id}
            initial={reduce ? false : { opacity: 0, y: 40, rotate: 0 }}
            animate={{ opacity: 1, ...pose[i] }}
            transition={{ ...springs.appear, delay: reduce ? 0 : 0.1 + i * 0.08 }}
            className="card absolute inset-x-6 top-6 flex flex-col gap-3 p-4"
            style={{ zIndex: i }}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                <Icon size={18} strokeWidth={2.4} />
              </span>
              <span className="text-callout font-bold">{t(`category.${c.category}`)}</span>
            </div>
            <p className="line-clamp-2 text-body font-bold">{c.title}</p>
            <div className="flex items-center justify-between">
              <span className="tabular text-title3 font-extrabold">{formatMoney(c.rewardCents)}</span>
              <span className="rounded-pill bg-fill px-3 py-1 text-caption">{t(`deadline.${c.deadline}`)}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------- 1–2. Email и код ----------
export function EmailStep({ next, email, setEmail }: StepProps & { email: string; setEmail: (v: string) => void }) {
  const sb = useSupabase();
  const r = useRunner();
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    const errs: Record<string, string> = {};
    if (!parsed.success) errs.email = parsed.error.issues[0]!.message;
    if (!terms) errs.terms = 'errors.terms_required';
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;
    void r.run(async () => {
      await auth.startEmail(sb, parsed.data);
      setEmail(parsed.data);
      next();
    });
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-6">
      <StepTitle title={t('onb.emailTitle')} subtitle={t('onb.emailText')} />
      <Input label={t('auth.email')} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <Checkbox checked={terms} onChange={setTerms} error={errors.terms}>
        {t('onb.acceptPrefix')}{' '}
        <Link href="/legal/terms" target="_blank" className="font-bold text-accent-text underline">
          {t('onb.terms')}
        </Link>{' '}
        {t('common.and')}{' '}
        <Link href="/legal/privacy" target="_blank" className="font-bold text-accent-text underline">
          {t('onb.privacy')}
        </Link>
      </Checkbox>
      <FormError error={r.error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={r.busy}>
          {t('common.continue')}
        </Button>
      </Footer>
    </form>
  );
}

export function CodeStep({ next, email, onChangeEmail, onExisting }: StepProps & { email: string; onChangeEmail: () => void; onExisting: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const r = useRunner();
  const cooldown = useCooldown();
  const [code, setCode] = useState('');
  useEffect(() => cooldown.start(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return r.setError(parsed.error.issues[0]!.message);
    void r.run(async () => {
      await auth.verifyEmail(sb, email, parsed.data);
      const me = await qc.fetchQuery({ queryKey: keys.me, queryFn: () => profile.me(sb) });
      if (me?.profile.onboarding === 'done') onExisting();
      else next();
    });
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-6">
      <StepTitle title={t('onb.codeTitle')} subtitle={t('onb.codeText', { email })} />
      <OtpInput label={t('auth.code')} value={code} onChange={setCode} autoFocus />
      <FormError error={r.error} />
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="plain"
          size="md"
          disabled={cooldown.left > 0 || r.busy}
          onClick={() =>
            r.run(async () => {
              await auth.startEmail(sb, email);
              cooldown.start();
            })
          }
        >
          {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')}
        </Button>
        <Button variant="plain" size="md" onClick={onChangeEmail}>
          {t('auth.changeEmail')}
        </Button>
      </div>
      <Footer>
        <Button type="submit" size="lg" block disabled={r.busy || code.length !== 6}>
          {t('auth.verify')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 3. Пароль ----------
export function PasswordStep({ next }: StepProps) {
  const sb = useSupabase();
  const r = useRunner();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const strength = passwordStrength(pw);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(pw);
    const errs: Record<string, string> = {};
    if (!parsed.success) errs.pw = parsed.error.issues[0]!.message;
    else if (pw !== pw2) errs.pw2 = t('onb.passwordMismatch');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    void r.run(async () => {
      await auth.updatePassword(sb, pw);
      next();
    });
  };
  const toggle = (
    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t('onb.hide') : t('onb.show')} className="absolute right-3 top-[38px] flex size-10 items-center justify-center rounded-full text-text-2 hover:bg-fill-strong">
      {show ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );
  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-6">
      <StepTitle title={t('onb.passwordTitle')} subtitle={t('onb.passwordText')} />
      <div className="relative">
        <Input label={t('auth.password')} type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} error={errors.pw} className="pr-14" />
        {toggle}
      </div>
      {pw && (
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={clsx('h-1.5 flex-1 rounded-pill', i <= strength ? (strength === 0 ? 'bg-danger' : strength === 1 ? 'bg-warning' : 'bg-success') : 'bg-fill')}
              />
            ))}
          </div>
          <span className="text-callout font-bold">{t(`onb.strength.${(['weak', 'medium', 'strong'] as const)[strength]}`)}</span>
        </div>
      )}
      <Input label={t('onb.passwordRepeat')} type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={errors.pw2} />
      <FormError error={r.error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={r.busy}>
          {t('common.continue')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 4. Личные данные ----------
export function PersonalStep({ me, next }: StepProps) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const p = me?.profile;
  const [v, setV] = useState({
    firstName: p?.first_name ?? '',
    lastName: p?.last_name ?? '',
    displayName: p?.display_name ?? '',
    birthDate: me?.private.birth_date ?? '',
  });
  const [avatar, setAvatar] = useState<string | null>(p?.avatar_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, error, save, run } = useSaveData(next);
  // Отображаемое имя по умолчанию: «Имя Ф.»
  const autoDisplay = [v.firstName.trim(), v.lastName.trim() ? `${v.lastName.trim()[0]}.` : ''].join(' ').trim();

  const pick = (f: File | undefined) => {
    if (!f || !me) return;
    if (f.size > 5 * 1024 * 1024) return setErrors({ photo: 'errors.file_too_big_5' });
    void run(async () => {
      const url = await files.uploadAvatar(sb, me.profile.id, f, f.type || 'image/jpeg');
      await profile.saveData(sb, { avatar_url: url });
      setAvatar(url);
      await qc.invalidateQueries({ queryKey: keys.me });
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = personalStepSchema.safeParse({ ...v, displayName: v.displayName || autoDisplay });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void save({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      display_name: parsed.data.displayName,
      birth_date: parsed.data.birthDate,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-6">
      <StepTitle title={t('onb.personalTitle')} subtitle={t('onb.personalText')} />
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label={avatar ? t('onb.changePhoto') : t('onb.photo')}>
          {avatar ? (
            <Avatar name={autoDisplay} url={avatar} size={88} />
          ) : (
            <span className="flex size-[88px] items-center justify-center rounded-full bg-fill text-text-2">
              <Camera size={30} />
            </span>
          )}
          <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-ink text-on-ink">
            <Plus size={18} strokeWidth={3} />
          </span>
        </button>
        <div className="flex flex-col">
          <button type="button" onClick={() => fileRef.current?.click()} className="text-left text-body font-bold">
            {avatar ? t('onb.changePhoto') : t('onb.photo')}
          </button>
          <span className="text-callout text-text-2">{t('onb.photoHint')}</span>
          <FormError error={errors.photo} />
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('onb.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} error={errors.firstName} />
        <Input label={t('onb.lastName')} autoComplete="family-name" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} error={errors.lastName} />
      </div>
      <Input label={t('onb.birthDate')} type="date" autoComplete="bday" value={v.birthDate} onChange={(e) => setV({ ...v, birthDate: e.target.value })} error={errors.birthDate} hint={t('onb.ageHint')} />
      <Input label={t('onb.displayName')} placeholder={autoDisplay} value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} error={errors.displayName} />
      <FormError error={error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={busy}>
          {t('common.continue')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 5. Местоположение и язык ----------
export function LocationStep({ me, next }: StepProps) {
  const p = me?.profile;
  const [country, setCountry] = useState(p?.country_code ?? '');
  const [city, setCity] = useState(p?.city ?? '');
  const [locale, setLocale] = useState(me?.private.locale ?? 'ru');
  const [currency, setCurrency] = useState(p?.display_currency ?? 'USD');
  const [langs, setLangs] = useState<WorkLanguage[]>(p?.languages.length ? p.languages : [{ code: 'ru', level: 'native' }]);
  const [adding, setAdding] = useState('');
  const timezone = p?.timezone ?? deviceTimezone();
  const { busy, error, save } = useSaveData(next);
  const countries = useMemo(
    () => COUNTRY_CODES.map((c) => ({ value: c, label: countryName(c) })).sort((a, b) => a.label.localeCompare(b.label, 'ru')),
    [],
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ country_code: country || null, city: city || null, timezone, locale, display_currency: currency, languages: langs });
      }}
      noValidate
      className="flex flex-1 flex-col gap-6"
    >
      <StepTitle title={t('onb.locationTitle')} subtitle={t('onb.locationText')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('onb.country')} value={country} onChange={(e) => setCountry(e.target.value)} options={countries} placeholder={t('onb.chooseCountry')} />
        <Input label={t('onb.city')} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="tile flex items-center justify-between px-4 py-3">
        <span className="text-callout font-bold text-text-2">{t('onb.timezone')}</span>
        <span className="text-body font-semibold">{timezone}</span>
      </div>
      <Select
        label={t('onb.uiLanguage')}
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
      />
      <div className="flex flex-col gap-3">
        <span className="text-callout font-bold">{t('onb.workLanguages')}</span>
        {langs.map((l, i) => (
          <div key={l.code} className="tile flex items-center gap-3 px-4 py-2">
            <span className="flex-1 font-bold">{languageName(l.code)}</span>
            <select
              aria-label={`${languageName(l.code)}: уровень`}
              value={l.level}
              onChange={(e) => setLangs(langs.map((x, j) => (j === i ? { ...x, level: e.target.value as WorkLanguage['level'] } : x)))}
              className="h-10 rounded-pill bg-card-solid px-3 text-callout font-bold"
            >
              {LANGUAGE_LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {t(`onb.levels.${lv}`)}
                </option>
              ))}
            </select>
            <button type="button" aria-label={t('common.remove')} onClick={() => setLangs(langs.filter((_, j) => j !== i))} className="flex size-9 items-center justify-center rounded-full text-text-2 hover:bg-fill-strong">
              <X size={18} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <select aria-label={t('onb.addLanguage')} value={adding} onChange={(e) => setAdding(e.target.value)} className="h-12 min-w-0 flex-1 rounded-md bg-fill px-4 font-semibold">
            <option value="">{t('onb.addLanguage')}</option>
            {WORK_LANGUAGES.filter((c) => !langs.some((l) => l.code === c)).map((c) => (
              <option key={c} value={c}>
                {languageName(c)}
              </option>
            ))}
          </select>
          <Button
            variant="glass"
            size="icon"
            aria-label={t('onb.addLanguage')}
            disabled={!adding || langs.length >= 10}
            onClick={() => {
              setLangs([...langs, { code: adding, level: 'b1' }]);
              setAdding('');
            }}
          >
            <Plus size={20} />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-callout font-bold">{t('onb.currency')}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('onb.currency')}>
          {DISPLAY_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={currency === c}
              onClick={() => setCurrency(c)}
              className={clsx('h-11 rounded-pill px-5 font-bold transition-colors', currency === c ? 'bg-ink text-on-ink' : 'bg-fill hover:bg-fill-strong')}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <FormError error={error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={busy}>
          {t('common.continue')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- Предпросмотр карточки профиля (справа на компьютере) ----------
export function ProfilePreview({ me, profession, level, skills }: { me: Me | null | undefined; profession?: string; level?: ExperienceLevel | null; skills?: string[] }) {
  const p = me?.profile;
  const name = p?.display_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—';
  const list = skills ?? me?.skills ?? [];
  return (
    <div className="card flex flex-col gap-4 p-6">
      <p className="text-caption uppercase text-text-2">{t('onb.preview')}</p>
      <div className="flex items-center gap-4">
        <Avatar name={name} url={p?.avatar_url} size={64} />
        <div className="min-w-0">
          <p className="truncate text-title3 font-bold">{name}</p>
          <p className="truncate text-callout text-text-2">
            {[profession || p?.profession, level ? t(`onb.exp.${level}`) : null, p?.city].filter(Boolean).join(' · ') || t('onb.none')}
          </p>
        </div>
      </div>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.slice(0, 8).map((s) => (
            <span key={s} className="rounded-pill bg-fill px-3 py-1 text-caption">
              {skillLabel(s)}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['—', t('account.rating')],
          ['0', t('dashboard.done')],
          [formatMoney(0), t('account.earned')],
        ].map(([v, l]) => (
          <div key={l} className="tile px-2 py-3">
            <p className="tabular font-extrabold">{v}</p>
            <p className="text-caption text-text-2">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const skillLabel = (slug: string) => {
  const key = `skill.${slug}` as TranslationKey;
  const text = t(key);
  return text === key ? slug : text;
};
const professionLabel = (id: string) => t(`profession.${id}` as TranslationKey);

// ---------- 6. Профессия ----------
export function ProfessionStep({ me, next, onPreview }: StepProps & { onPreview: (v: { profession: string; level: ExperienceLevel | null }) => void }) {
  const p = me?.profile;
  const known = PROFESSIONS.find((x) => professionLabel(x.id) === p?.profession);
  const [selected, setSelected] = useState<string | null>(known?.id ?? null);
  const [custom, setCustom] = useState(known || !p?.profession ? '' : p.profession);
  const [showCustom, setShowCustom] = useState(!!custom);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<ExperienceLevel | null>(p?.experience_level ?? null);
  const { busy, error, save, setError } = useSaveData(next);
  const name = showCustom ? custom.trim() : selected ? professionLabel(selected) : '';
  useEffect(() => onPreview({ profession: name, level }), [name, level]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = PROFESSIONS.filter((x) => !query || professionLabel(x.id).toLowerCase().includes(query.toLowerCase()));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name) return setError('errors.required');
        void save({ profession: name, headline: name, experience_level: level });
        if (selected) sessionStorage.setItem('parri.profession', selected);
      }}
      noValidate
      className="flex flex-1 flex-col gap-6"
    >
      <StepTitle title={t('onb.professionTitle')} subtitle={t('onb.professionText')} />
      <Input label={t('onb.professionSearch')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="grid max-h-[340px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label={t('onb.professionTitle')}>
        {list.map((x) => {
          const Icon = categoryIcon(x.category);
          return (
            <OptionTile
              key={x.id}
              selected={!showCustom && selected === x.id}
              onClick={() => {
                setSelected(x.id);
                setShowCustom(false);
              }}
              icon={<Icon size={20} strokeWidth={2.4} />}
              title={professionLabel(x.id)}
            />
          );
        })}
      </div>
      {showCustom ? (
        <Input label={t('onb.professionCustom')} placeholder={t('onb.professionCustomPlaceholder')} value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={80} autoFocus />
      ) : (
        <button type="button" onClick={() => setShowCustom(true)} className="self-start text-callout font-bold text-accent-text">
          + {t('onb.professionCustom')}
        </button>
      )}
      <div className="flex flex-col gap-3">
        <span className="text-callout font-bold">{t('onb.experience')}</span>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('onb.experience')}>
          {EXPERIENCE_LEVELS.map((lv) => (
            <OptionTile key={lv} selected={level === lv} onClick={() => setLevel(lv)} title={t(`onb.exp.${lv}`)} subtitle={t(`onb.expHint.${lv}`)} />
          ))}
        </div>
      </div>
      <FormError error={error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={busy || !name}>
          {t('common.next')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 7. Навыки ----------
export function SkillsStep({ me, next, onPreview }: StepProps & { onPreview: (skills: string[]) => void }) {
  const catalog = useSkills();
  const [selected, setSelected] = useState<string[]>(me?.skills ?? []);
  const [custom, setCustom] = useState<string[]>(me?.profile.custom_skills ?? []);
  const [customText, setCustomText] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(24);
  const { busy, error, save } = useSaveData(next);
  useEffect(() => onPreview([...selected, ...custom]), [selected, custom]); // eslint-disable-line react-hooks/exhaustive-deps

  const professionId =
    (typeof window !== 'undefined' && sessionStorage.getItem('parri.profession')) ||
    PROFESSIONS.find((x) => professionLabel(x.id) === me?.profile.profession)?.id;
  const recommended = PROFESSIONS.find((x) => x.id === professionId)?.skills ?? [];
  const total = selected.length + custom.length;
  const toggle = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : total >= SKILLS_MAX ? s : [...s, slug]));
  const all = (catalog.data ?? []).filter((s) => !recommended.includes(s.slug)).filter((s) => !query || skillLabel(s.slug).toLowerCase().includes(query.toLowerCase()));

  const chip = (slug: string, label: string) => {
    const on = selected.includes(slug);
    return (
      <button
        key={slug}
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={() => toggle(slug)}
        className={clsx('inline-flex h-11 items-center gap-1.5 rounded-pill px-4 text-callout font-bold transition-colors', on ? 'bg-ink text-on-ink' : 'bg-fill hover:bg-fill-strong')}
      >
        {on && <CheckCircle2 size={16} />}
        {label}
      </button>
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ skills: selected, custom_skills: custom });
      }}
      noValidate
      className="flex flex-1 flex-col gap-6"
    >
      <StepTitle title={t('onb.skillsTitle')} subtitle={t('onb.skillsText')} />
      <div className="flex items-center justify-between gap-3">
        <span className={clsx('tabular text-callout font-bold', total < SKILLS_MIN ? 'text-text-2' : 'text-success')}>{t('onb.selected', { n: total })}</span>
        {total > 0 && (
          <button
            type="button"
            className="text-callout font-bold text-accent-text"
            onClick={() => {
              setSelected([]);
              setCustom([]);
            }}
          >
            {t('onb.clearAll')}
          </button>
        )}
      </div>
      <Input label={t('onb.skillsSearch')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      {recommended.length > 0 && !query && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-callout font-bold">
            <Sparkles size={16} className="text-accent" />
            {t('onb.recommended')}
          </h2>
          <div className="flex flex-wrap gap-2">{recommended.map((s) => chip(s, skillLabel(s)))}</div>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-callout font-bold">{t('onb.allSkills')}</h2>
        <div className="flex flex-wrap gap-2">{all.slice(0, limit).map((s) => chip(s.slug, skillLabel(s.slug)))}</div>
        {all.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 24)} className="self-start text-callout font-bold text-accent-text">
            {t('onb.showMore')}
          </button>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-callout font-bold">{t('onb.addCustom')}</h2>
        {custom.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {custom.map((c) => (
              <span key={c} className="inline-flex h-11 items-center gap-1.5 rounded-pill bg-ink pl-4 pr-2 text-callout font-bold text-on-ink">
                {c}
                <button type="button" aria-label={`${t('common.remove')} ${c}`} onClick={() => setCustom(custom.filter((x) => x !== c))} className="flex size-7 items-center justify-center rounded-full hover:bg-on-ink/15">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            aria-label={t('onb.customPlaceholder')}
            placeholder={t('onb.customPlaceholder')}
            value={customText}
            maxLength={40}
            onChange={(e) => setCustomText(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-md bg-fill px-4 font-medium outline-none focus:ring-2 focus:ring-ink"
          />
          <Button
            variant="glass"
            size="icon"
            aria-label={t('onb.addCustom')}
            disabled={!customText.trim() || custom.length >= 10 || total >= SKILLS_MAX}
            onClick={() => {
              const v = customText.trim();
              if (v && !custom.includes(v)) setCustom([...custom, v]);
              setCustomText('');
            }}
          >
            <Plus size={20} />
          </Button>
        </div>
      </section>
      <FormError error={error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={busy || total < SKILLS_MIN}>
          {t('common.next')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 8. О себе и портфолио ----------
export function AboutStep({ me, next }: StepProps) {
  const sb = useSupabase();
  const p = me?.profile;
  const [bio, setBio] = useState(p?.bio ?? '');
  const [links, setLinks] = useState<ProfileLink[]>(p?.links ?? []);
  const [exp, setExp] = useState<{ company: string; position: string; from_year: number | null; to_year: number | null }[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, error, save, run } = useSaveData(next);

  useEffect(() => {
    if (!me) return;
    profile.experience(sb, me.profile.id).then((rows) => setExp(rows.map(({ company, position, from_year, to_year }) => ({ company, position, from_year, to_year })))).catch(() => {});
  }, [sb, me]);

  const aiWrite = () => {
    const skills = [...(me?.skills ?? []).map(skillLabel), ...(p?.custom_skills ?? [])].slice(0, 5).join(', ');
    setBio(t('onb.bioTemplate', { profession: p?.profession ?? t('profession.student'), skills: skills || '—' }));
  };

  const upload = (f: File | undefined) => {
    if (!f || !me) return;
    if (f.size > 10 * 1024 * 1024) return setErrors({ file: 'errors.file_too_big_10' });
    void run(async () => {
      const path = `${me.profile.id}/${crypto.randomUUID()}-${f.name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-60)}`;
      await files.upload(sb, path, f, f.type || 'application/octet-stream', 'portfolio');
      await profile.addPortfolio(sb, { title: f.name, url: null, file_path: path, category: null, visibility: 'public' });
      setUploaded((u) => [...u, f.name]);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = bioSchema.safeParse(bio);
    if (!parsed.success) return setErrors({ bio: parsed.error.issues[0]!.message });
    setErrors({});
    void save({
      bio: parsed.data || null,
      links: links.filter((l) => l.url.trim()).map((l) => ({ title: l.title.trim() || l.url.trim(), url: l.url.trim() })),
      experience: exp.filter((x) => x.company.trim() && x.position.trim()),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-6">
      <StepTitle title={t('onb.aboutTitle')} subtitle={t('onb.aboutText')} />
      <div className="flex flex-col gap-2">
        <TextArea label={t('onb.bio')} placeholder={t('onb.bioPlaceholder')} rows={5} value={bio} onChange={(e) => setBio(e.target.value)} error={errors.bio} counterMax={1000} />
        <button type="button" onClick={aiWrite} className="inline-flex h-10 items-center gap-1.5 self-start rounded-pill bg-accent-soft px-4 text-callout font-bold text-accent-text">
          <Sparkles size={16} />
          {t('onb.aiWrite')}
        </button>
      </div>

      <section className="flex flex-col gap-3">
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-2">
            <Input label={t('onb.linkTitle')} value={l.title} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Input label={t('onb.linkUrl')} type="url" placeholder="https://" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <Button variant="plain" size="icon" aria-label={t('common.remove')} onClick={() => setLinks(links.filter((_, j) => j !== i))} className="mb-1">
              <X size={18} />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={links.length >= 10} onClick={() => setLinks([...links, { title: '', url: '' }])} className="inline-flex h-11 items-center gap-2 rounded-pill bg-fill px-4 font-bold hover:bg-fill-strong">
            <Link2 size={18} />
            {t('onb.addLink')}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-pill bg-fill px-4 font-bold hover:bg-fill-strong">
            <Plus size={18} />
            {t('onb.addFile')}
          </button>
          <button type="button" disabled={exp.length >= 10} onClick={() => setExp([...exp, { company: '', position: '', from_year: null, to_year: null }])} className="inline-flex h-11 items-center gap-2 rounded-pill bg-fill px-4 font-bold hover:bg-fill-strong">
            <Briefcase size={18} />
            {t('onb.addExperience')}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <p className="text-caption text-text-2">{t('onb.fileHint')}</p>
        <FormError error={errors.file} />
        {uploaded.map((n) => (
          <p key={n} className="tile flex items-center gap-2 px-4 py-3 text-callout font-semibold">
            <CheckCircle2 size={18} className="text-success" />
            {n}
          </p>
        ))}
      </section>

      {exp.map((x, i) => (
        <div key={i} className="card flex flex-col gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('onb.company')} value={x.company} onChange={(e) => setExp(exp.map((y, j) => (j === i ? { ...y, company: e.target.value } : y)))} />
            <Input label={t('onb.position')} value={x.position} onChange={(e) => setExp(exp.map((y, j) => (j === i ? { ...y, position: e.target.value } : y)))} />
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <Input label={t('onb.fromYear')} inputMode="numeric" value={x.from_year ?? ''} onChange={(e) => setExp(exp.map((y, j) => (j === i ? { ...y, from_year: Number(e.target.value) || null } : y)))} />
            <Input label={t('onb.toYear')} inputMode="numeric" value={x.to_year ?? ''} onChange={(e) => setExp(exp.map((y, j) => (j === i ? { ...y, to_year: Number(e.target.value) || null } : y)))} />
            <Button variant="plain" size="icon" aria-label={t('common.remove')} onClick={() => setExp(exp.filter((_, j) => j !== i))} className="mb-1">
              <X size={18} />
            </Button>
          </div>
        </div>
      ))}

      <FormError error={error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={busy}>
          {t('common.continue')}
        </Button>
        <Button variant="plain" size="md" block onClick={next}>
          {t('common.skip')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 9. Образование ----------
export function EducationStep({ me, next }: StepProps) {
  const p = me?.profile;
  const [query, setQuery] = useState(me?.university?.name ?? '');
  const [uni, setUni] = useState<{ id: number; name: string } | null>(me?.university ? { id: me.university.id, name: me.university.name } : null);
  const [faculty, setFaculty] = useState(p?.faculty ?? '');
  const [specialty, setSpecialty] = useState(p?.specialty ?? '');
  const [studentEmail, setStudentEmail] = useState(me?.private.student_email ?? '');
  const search = useUniversitySearch(uni ? '' : query);
  const { busy, error, save } = useSaveData(next);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ university_id: uni?.id ?? null, faculty: faculty || null, specialty: specialty || null, student_email: studentEmail || null });
      }}
      noValidate
      className="flex flex-1 flex-col gap-6"
    >
      <StepTitle title={t('onb.eduTitle')} subtitle={t('onb.eduText')} />
      {uni ? (
        <OptionTile selected icon={<GraduationCap size={20} />} title={uni.name} subtitle={t('common.edit')} onClick={() => setUni(null)} />
      ) : (
        <div className="flex flex-col gap-2">
          <Input label={t('onb.university')} type="search" placeholder={t('onb.universitySearch')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-col gap-2" role="listbox" aria-label={t('onb.university')}>
            {(search.data ?? []).slice(0, 6).map((u) => (
              <OptionTile key={u.id} icon={<GraduationCap size={20} />} title={u.name} subtitle={countryName(u.country_code)} onClick={() => setUni({ id: u.id, name: u.name })} />
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('onb.faculty')} value={faculty} onChange={(e) => setFaculty(e.target.value)} maxLength={120} />
        <Input label={t('onb.specialty')} value={specialty} onChange={(e) => setSpecialty(e.target.value)} maxLength={120} />
      </div>
      <Input label={t('onb.studentEmail')} type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
      <FormError error={error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={busy || !uni}>
          {t('onb.addAndContinue')}
        </Button>
        <Button variant="plain" size="md" block onClick={next}>
          {t('common.skip')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 10. Безопасность и соглашения ----------
export function SecurityStep({ me, next, goTo }: StepProps) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const r = useRunner();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const p = me?.profile;
  const skills = [...(me?.skills ?? []).map(skillLabel), ...(p?.custom_skills ?? [])];
  const edit = (step: StepId) => (
    <button type="button" onClick={() => goTo?.(step)} className="text-callout font-bold text-accent-text">
      {t('common.edit')}
    </button>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void r.run(async () => {
          await profile.complete(sb, { terms, privacy, twoFactor, notifications });
          await qc.invalidateQueries({ queryKey: keys.me });
          next();
        });
      }}
      noValidate
      className="flex flex-1 flex-col gap-6"
    >
      <StepTitle title={t('onb.securityTitle')} subtitle={t('onb.securityText')} />
      <ListGroup>
        <ListRow title={t('onb.sumName')} subtitle={[p?.first_name, p?.last_name].filter(Boolean).join(' ') || t('onb.none')} trailing={edit('personal')} />
        <ListRow title={t('onb.sumLocation')} subtitle={[p?.city, p?.country_code ? countryName(p.country_code) : null].filter(Boolean).join(', ') || t('onb.none')} trailing={edit('location')} />
        <ListRow title={t('onb.sumProfession')} subtitle={[p?.profession, p?.experience_level ? t(`onb.exp.${p.experience_level}`) : null].filter(Boolean).join(' · ') || t('onb.none')} trailing={edit('profession')} />
        <ListRow title={t('onb.sumSkills')} subtitle={skills.join(', ') || t('onb.none')} trailing={edit('skills')} />
        <ListRow title={t('onb.sumEducation')} subtitle={me?.university?.name ?? t('onb.none')} trailing={edit('education')} />
      </ListGroup>
      <ListGroup>
        <ListRow title={t('onb.twoFactor')} subtitle={t('onb.twoFactorHint')} trailing={<Toggle checked={twoFactor} onChange={setTwoFactor} label={t('onb.twoFactor')} />} />
        <ListRow title={t('onb.notifications')} subtitle={t('onb.notificationsHint')} trailing={<Toggle checked={notifications} onChange={setNotifications} label={t('onb.notifications')} />} />
      </ListGroup>
      <div className="flex flex-col gap-3">
        <Checkbox checked={terms} onChange={setTerms}>
          <Link href="/legal/terms" target="_blank" className="font-bold underline">
            {t('onb.agreeTerms')}
          </Link>
        </Checkbox>
        <Checkbox checked={privacy} onChange={setPrivacy}>
          <Link href="/legal/privacy" target="_blank" className="font-bold underline">
            {t('onb.agreePrivacy')}
          </Link>
        </Checkbox>
      </div>
      <FormError error={r.error} />
      <Footer>
        <Button type="submit" size="lg" block disabled={r.busy || !terms || !privacy}>
          {t('onb.confirm')}
        </Button>
      </Footer>
    </form>
  );
}

// ---------- 11. Готово ----------
export function DoneStep({ onFinish }: { onFinish: (to: string) => void }) {
  const feed = useFeed({ kind: 'online', sort: 'recommended' }, null);
  const tasks = (feed.data?.pages.flat() ?? []).slice(0, 3);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <span className="flex size-24 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_12px_32px_rgba(255,84,40,0.4)]">
          <CheckCircle2 size={48} strokeWidth={2.4} />
        </span>
        <StepTitle title={t('onb.doneTitle')} subtitle={t('onb.doneText')} />
      </div>
      <ol className="flex flex-col gap-2">
        {(['how1', 'how2', 'how3'] as const).map((k, i) => (
          <li key={k} className="tile flex items-center gap-4 px-4 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-extrabold text-on-ink">{i + 1}</span>
            <span className="font-semibold">{t(`onb.${k}`)}</span>
          </li>
        ))}
      </ol>
      {tasks.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title3 font-bold">{t('onb.firstTasks')}</h2>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              href={`/tasks/${task.id}`}
              task={{ id: task.id, title: task.title, rewardCents: task.reward_cents, kind: task.kind, category: task.category as Category, deadline: task.deadline }}
            />
          ))}
        </section>
      )}
      <Footer>
        <Button size="lg" block onClick={() => onFinish('/feed')}>
          {t('onb.toTasks')}
        </Button>
        <Button variant="glass" size="lg" block onClick={() => onFinish('/account')}>
          {t('onb.openProfile')}
        </Button>
      </Footer>
    </div>
  );
}
