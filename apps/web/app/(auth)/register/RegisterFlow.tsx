'use client';

import {
  accountSchema,
  auth,
  CATEGORIES,
  fieldErrors,
  otpSchema,
  profile,
  profileStepSchema,
  t,
  toApiError,
  type TranslationKey,
  type University,
} from '@parri/shared';
import { keys, useMe, useSession, useSkills, useSupabase, useUniversitySearch } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { FormError, Input } from '@/components/ui/Field';
import { OtpInput } from '@/components/ui/OtpInput';
import { CenterSpinner, PageTitle } from '@/components/ui/bits';
import { useCooldown } from '../useCooldown';
import { Stepper } from './Stepper';

function useRunner() {
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
  return { busy, error, run };
}

function AccountStep() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, run } = useRunner();
  const cooldown = useCooldown();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = accountSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void run(async () => {
      await auth.signUp(sb, parsed.data.email, parsed.data.password);
      setSent(true);
      cooldown.start();
    });
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return setErrors({ code: parsed.error.issues[0]!.message });
    void run(async () => {
      await auth.verifySignup(sb, email.trim().toLowerCase(), parsed.data);
      await qc.invalidateQueries({ queryKey: keys.me });
    });
  };

  if (sent) {
    return (
      <form onSubmit={verify} className="card flex flex-col gap-5 p-6" noValidate>
        <h2 className="text-title3 font-bold">{t('register.codeTitle')}</h2>
        <p className="text-body text-text-2">{t('auth.codeSent', { email })}</p>
        <OtpInput label={t('auth.code')} value={code} onChange={setCode} autoFocus />
        <FormError error={error ?? errors.code} />
        <Button type="submit" size="lg" block disabled={busy || code.length !== 6}>
          {t('auth.verify')}
        </Button>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="plain" disabled={cooldown.left > 0 || busy} onClick={() => run(async () => { await auth.resendSignup(sb, email); cooldown.start(); })}>
            {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')}
          </Button>
          <Button variant="plain" onClick={() => setSent(false)}>
            {t('auth.changeEmail')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-5 p-6" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-title3 font-bold">{t('register.accountTitle')}</h2>
        <p className="text-body text-text-2">{t('register.accountText')}</p>
      </div>
      <Input label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <Input
        label={t('auth.password')}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint={t('auth.passwordHint')}
      />
      <FormError error={error} />
      <Button type="submit" size="lg" block disabled={busy}>
        {t('common.next')}
      </Button>
    </form>
  );
}

function ProfileStep() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [v, setV] = useState({ firstName: '', lastName: '', birthDate: '', phone: '', locale: 'ru' as const });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, run } = useRunner();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileStepSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void run(async () => {
      await profile.saveProfile(sb, parsed.data);
      await qc.invalidateQueries({ queryKey: keys.me });
    });
  };

  return (
    <form onSubmit={submit} className="card flex flex-col gap-5 p-6" noValidate>
      <h2 className="text-title3 font-bold">{t('register.profileTitle')}</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label={t('register.firstName')} autoComplete="given-name" value={v.firstName} onChange={set('firstName')} error={errors.firstName} />
        <Input label={t('register.lastName')} autoComplete="family-name" value={v.lastName} onChange={set('lastName')} error={errors.lastName} />
      </div>
      <Input
        label={t('register.birthDate')}
        type="date"
        autoComplete="bday"
        value={v.birthDate}
        onChange={set('birthDate')}
        error={errors.birthDate}
        hint={t('register.ageHint')}
        max={new Date().toISOString().slice(0, 10)}
      />
      <Input label={t('register.phone')} type="tel" autoComplete="tel" placeholder="+7 999 123-45-67" value={v.phone} onChange={set('phone')} error={errors.phone} />
      <div className="flex flex-col gap-2">
        <span className="text-callout font-bold">{t('register.language')}</span>
        <div>
          <Chip selected>{t('register.ru')}</Chip>
        </div>
      </div>
      <FormError error={error} />
      <Button type="submit" size="lg" block disabled={busy}>
        {t('common.next')}
      </Button>
    </form>
  );
}

function UniversityPicker({ value, onChange }: { value: University | null; onChange: (u: University | null) => void }) {
  const [q, setQ] = useState('');
  const { data = [], isFetching } = useUniversitySearch(q);
  if (value) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-callout font-bold">{t('register.university')}</span>
        <div className="flex items-center justify-between gap-3 rounded-md border border-card-border bg-card-solid px-4 py-3">
          <span className="font-semibold">
            {value.name} <span className="text-text-2">· {value.country}</span>
          </span>
          <button type="button" aria-label={t('common.remove')} onClick={() => onChange(null)} className="text-text-2">
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Input
        label={t('register.university')}
        placeholder={t('register.universityPlaceholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        hint={t('register.universityHint')}
        role="combobox"
        aria-expanded={data.length > 0}
        aria-controls="uni-list"
      />
      {q.trim().length >= 2 && (
        <ul id="uni-list" role="listbox" className="card max-h-64 overflow-y-auto p-1">
          {data.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onChange(u)}
                className="w-full rounded-sm px-3 py-2.5 text-left hover:bg-separator"
              >
                <span className="font-semibold">{u.name}</span> <span className="text-callout text-text-2">· {u.country}</span>
              </button>
            </li>
          ))}
          {!isFetching && data.length === 0 && <li className="px-3 py-2.5 text-text-2">{t('feed.empty')}</li>}
        </ul>
      )}
    </div>
  );
}

function SkillsStep() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { data: skills = [] } = useSkills();
  const [selected, setSelected] = useState<string[]>([]);
  const [uni, setUni] = useState<University | null>(null);
  const { busy, error, run } = useRunner();
  const grouped = useMemo(
    () => CATEGORIES.map((c) => ({ c, items: skills.filter((s) => s.category === c) })).filter((g) => g.items.length),
    [skills],
  );
  const toggle = (slug: string) => setSelected((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  return (
    <div className="card flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-title3 font-bold">{t('register.skillsTitle')}</h2>
        <p className="text-body text-text-2">{t('register.skillsText')}</p>
      </div>
      {grouped.map(({ c, items }) => (
        <div key={c} className="flex flex-col gap-2">
          <h3 className="text-callout font-bold text-text-2">{t(`category.${c}`)}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map((s) => (
              <Chip key={s.slug} selected={selected.includes(s.slug)} onClick={() => toggle(s.slug)}>
                {t(`skill.${s.slug}` as TranslationKey)}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      <UniversityPicker value={uni} onChange={setUni} />
      <FormError error={error} />
      <Button
        size="lg"
        block
        disabled={busy}
        onClick={() =>
          run(async () => {
            await profile.saveSkills(sb, selected, uni?.id ?? null);
            await qc.invalidateQueries({ queryKey: keys.me });
          })
        }
      >
        {t('common.next')}
      </Button>
    </div>
  );
}

function DoneStep() {
  const router = useRouter();
  return (
    <div className="card flex flex-col items-start gap-4 p-6">
      <h2 className="text-title1 font-extrabold">{t('register.doneTitle')}</h2>
      <p className="text-body text-text-2">{t('register.doneText')}</p>
      <Button size="lg" onClick={() => router.replace('/feed')}>
        {t('register.toFeed')}
      </Button>
    </div>
  );
}

export function RegisterFlow() {
  const { session, loading } = useSession();
  const me = useMe(!!session);
  const [finishedHere, setFinishedHere] = useState(false);
  const router = useRouter();
  const onboarding = me.data?.profile.onboarding;

  useEffect(() => {
    if (onboarding === 'skills') setFinishedHere(true);
  }, [onboarding]);
  useEffect(() => {
    // Уже зарегистрированный пользователь, зашедший сюда из ссылки, — в ленту
    if (onboarding === 'done' && !finishedHere) router.replace('/feed');
  }, [onboarding, finishedHere, router]);

  if (loading || (session && me.isLoading)) return <CenterSpinner />;

  const step: 0 | 1 | 2 | 3 = !session ? 0 : onboarding === 'profile' ? 1 : onboarding === 'skills' ? 2 : 3;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t('register.title')}</PageTitle>
      <Stepper current={step} />
      {step === 0 && <AccountStep />}
      {step === 1 && <ProfileStep />}
      {step === 2 && <SkillsStep />}
      {step === 3 && <DoneStep />}
      {step === 0 && (
        <p className="text-center text-body text-text-2">
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-bold text-accent-text">
            {t('auth.submit')}
          </Link>
        </p>
      )}
    </div>
  );
}
