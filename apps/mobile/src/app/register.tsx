/**
 * Регистрация по шагам в стиле Cal AI: один вопрос на экран, крупный заголовок, серые плитки,
 * большая кнопка внизу. Шаги и проверки — те же, что на вебе (save_profile_data / complete_onboarding).
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
  type ExperienceLevel,
  type Me,
  type ProfileData,
  type TranslationKey,
  type WorkLanguage,
} from '@parri/shared';
import { keys, useFeed, useMe, useSession, useSkills, useSupabase, useUniversitySearch } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import {
  Briefcase,
  Camera,
  CircleCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Link,
  Mail,
  Plus,
  Sparkles,
  X,
} from '@/components/icons';
import { TaskCard } from '@/components/task/TaskCard';
import { categoryIcon } from '@/components/task/categoryIcon';
import { Checkbox } from '@/components/ui/Checkbox';
import { OtpField } from '@/components/ui/OtpField';
import { StepScreen } from '@/components/ui/StepScreen';
import { FormError, TextField } from '@/components/ui/TextField';
import { WheelDate } from '@/components/ui/WheelDate';
import { Avatar, Center } from '@/components/ui/bits';
import { Card, ListGroup, ListRow, OptionTile, StepTitle, Toggle } from '@/components/ui/kit';
import { useCooldown, useRunner } from '@/lib/useRunner';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

type StepId =
  | 'start' | 'email' | 'code' | 'password' | 'personal' | 'location'
  | 'profession' | 'skills' | 'about' | 'education' | 'security' | 'done';

const ORDER: StepId[] = ['start', 'email', 'code', 'password', 'personal', 'location', 'profession', 'skills', 'about', 'education', 'security', 'done'];
const PHASE: Record<StepId, 'account' | 'profile' | 'skills' | 'security' | 'done'> = {
  start: 'account', email: 'account', code: 'account', password: 'account',
  personal: 'profile', location: 'profile', profession: 'profile',
  skills: 'skills', about: 'skills', education: 'skills',
  security: 'security', done: 'done',
};

const skillLabel = (slug: string) => {
  const key = `skill.${slug}` as TranslationKey;
  const text = t(key);
  return text === key ? slug : text;
};
const professionLabel = (id: string) => t(`profession.${id}` as TranslationKey);

function resumeStep(me: Me): StepId {
  const p = me.profile;
  if (!p.first_name || !p.last_name || !me.private.birth_date) return 'personal';
  if (!p.country_code && !p.city) return 'location';
  if (!p.profession) return 'profession';
  if (me.skills.length + p.custom_skills.length < SKILLS_MIN) return 'skills';
  return 'about';
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

/** Пилюля-переключатель (валюта, уровень языка) */
function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: selected ? colors.ink : colors.fill }]}
    >
      <AppText variant="callout" style={{ fontFamily: familyByWeight['700'], color: selected ? colors.onInk : colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function SkillChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.ink : colors.fill }]}
    >
      {selected ? <CircleCheck size={16} color={colors.onInk} /> : null}
      <AppText variant="callout" style={{ fontFamily: familyByWeight['700'], color: selected ? colors.onInk : colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Веер из карточек задач на стартовом экране */
function HeroStack() {
  const { colors } = useTheme();
  const pose = [
    { rotate: '-7deg', x: -14, y: 22 },
    { rotate: '5deg', x: 18, y: 10 },
    { rotate: '-1deg', x: 0, y: 0 },
  ];
  return (
    <View style={{ height: 230, marginTop: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {showcaseTasks.slice(0, 3).map((c, i) => {
        const Icon = categoryIcon(c.category);
        return (
          <Animated.View
            key={c.id}
            entering={FadeInDown.springify().delay(100 + i * 80)}
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.cardSolid,
                borderColor: colors.cardBorder,
                boxShadow: `0px 10px 30px ${colors.cardShadow}`,
                transform: [{ translateX: pose[i]!.x }, { translateY: pose[i]!.y }, { rotate: pose[i]!.rotate }],
                zIndex: i,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon size={18} strokeWidth={2.4} color={colors.accentText} />
              </View>
              <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
                {t(`category.${c.category}`)}
              </AppText>
            </View>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {c.title}
            </AppText>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="title3" tabular style={{ fontFamily: familyByWeight['800'] }}>
                {formatMoney(c.rewardCents)}
              </AppText>
              <View style={[styles.pill, { height: 28, backgroundColor: colors.fill }]}>
                <AppText variant="caption">{t(`deadline.${c.deadline}`)}</AppText>
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function Register() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { session, loading } = useSession();
  const me = useMe(!!session);
  const [step, setStep] = useState<StepId | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (step || loading) return;
    if (!session) return setStep('start');
    if (me.isLoading || !me.data) return;
    if (me.data.profile.onboarding === 'done') router.replace('/home');
    else setStep(resumeStep(me.data));
  }, [step, loading, session, me.isLoading, me.data]);

  if (!step) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <Center />
      </View>
    );
  }

  const index = ORDER.indexOf(step);
  const go = (to: StepId) => setStep(to);
  const next = () => go(ORDER[index + 1]!);
  const minBack = session ? ORDER.indexOf('personal') : 1;
  const back = index > minBack && step !== 'done' && step !== 'password' ? () => go(ORDER[index - 1]!) : step === 'email' ? () => go('start') : undefined;
  const frame = { stepKey: step, step: index, total: ORDER.length - 1, phase: t(`onb.phases.${PHASE[step]}`), onBack: back };
  const p = me.data?.profile;

  switch (step) {
    case 'start':
      return <StartStep onEmail={next} />;
    case 'email':
      return <EmailStep frame={frame} email={email} setEmail={setEmail} next={next} />;
    case 'code':
      return (
        <CodeStep
          frame={frame}
          email={email}
          onChangeEmail={() => go('email')}
          next={async () => {
            const fresh = await qc.fetchQuery({ queryKey: keys.me, queryFn: () => profile.me(sb) });
            if (fresh?.profile.onboarding === 'done') router.replace('/home');
            else next();
          }}
        />
      );
    case 'password':
      return <PasswordStep frame={frame} next={next} />;
    case 'personal':
      return <PersonalStep frame={frame} me={me.data} next={next} />;
    case 'location':
      return <LocationStep frame={frame} me={me.data} next={next} />;
    case 'profession':
      return <ProfessionStep frame={frame} me={me.data} next={next} />;
    case 'skills':
      return <SkillsStep frame={frame} me={me.data} next={next} />;
    case 'about':
      return <AboutStep frame={frame} me={me.data} next={next} />;
    case 'education':
      return <EducationStep frame={frame} me={me.data} next={next} />;
    case 'security':
      return <SecurityStep frame={frame} me={me.data} next={next} goTo={go} name={[p?.first_name, p?.last_name].filter(Boolean).join(' ')} />;
    case 'done':
      return <DoneStep />;
  }
}

type Frame = { stepKey: string; step: number; total: number; phase: string; onBack?: () => void };

// ---------- 0. Старт ----------
function StartStep({ onEmail }: { onEmail: () => void }) {
  const sb = useSupabase();
  const { colors } = useTheme();
  const r = useRunner();
  const oauth = (provider: 'google' | 'apple') =>
    r.run(async () => {
      try {
        await auth.signInWithProvider(sb, provider);
      } catch {
        throw new Error(t('errors.oauth_unavailable', { provider: provider === 'google' ? 'Google' : 'Apple' }));
      }
    });
  return (
    <StepScreen
      stepKey="start"
      footer={
        <>
          <Button variant="glass" size="lg" block label={t('onb.google')} onPress={() => oauth('google')} disabled={r.busy} />
          <Button variant="glass" size="lg" block label={t('onb.apple')} onPress={() => oauth('apple')} disabled={r.busy} />
          <Button size="lg" block label={t('onb.email')} icon={<Mail size={20} strokeWidth={2.6} color={colors.onAccent} />} onPress={onEmail} testID="start-email" />
          <FormError error={r.error} />
          <Pressable onPress={() => router.replace('/login')} style={{ paddingVertical: 8 }}>
            <AppText variant="callout" color="accentText" style={{ textAlign: 'center', fontFamily: familyByWeight['700'] }}>
              {t('onb.haveAccount')}
            </AppText>
          </Pressable>
        </>
      }
    >
      <AppText variant="title1" accessibilityRole="header" style={{ fontFamily: familyByWeight['800'] }}>
        {t('app.name')}
        <AppText variant="title1" style={{ color: colors.accent }}>
          .
        </AppText>
      </AppText>
      <StepTitle title={t('onb.welcomeTitle')} subtitle={t('onb.welcomeText')} />
      <HeroStack />
    </StepScreen>
  );
}

// ---------- 1–2. Email и код ----------
function EmailStep({ frame, email, setEmail, next }: { frame: Frame; email: string; setEmail: (v: string) => void; next: () => void }) {
  const sb = useSupabase();
  const r = useRunner();
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
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
    <StepScreen {...frame} footer={<Button size="lg" block label={t('common.continue')} onPress={submit} disabled={r.busy} testID="next" />}>
      <StepTitle title={t('onb.emailTitle')} subtitle={t('onb.emailText')} />
      <TextField label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} autoFocus />
      <Checkbox checked={terms} onChange={setTerms} label={`${t('onb.acceptPrefix')} ${t('onb.terms')} ${t('common.and')} ${t('onb.privacy')}`} testID="terms">
        <AppText variant="callout">
          {t('onb.acceptPrefix')}{' '}
          <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }} onPress={() => router.push('/legal/terms')}>
            {t('onb.terms')}
          </AppText>{' '}
          {t('common.and')}{' '}
          <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }} onPress={() => router.push('/legal/privacy')}>
            {t('onb.privacy')}
          </AppText>
        </AppText>
      </Checkbox>
      <FormError error={errors.terms ?? r.error} />
    </StepScreen>
  );
}

function CodeStep({ frame, email, onChangeEmail, next }: { frame: Frame; email: string; onChangeEmail: () => void; next: () => Promise<void> }) {
  const sb = useSupabase();
  const r = useRunner();
  const cooldown = useCooldown();
  const [code, setCode] = useState('');
  useEffect(() => cooldown.start(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => {
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return r.setError(parsed.error.issues[0]!.message);
    void r.run(async () => {
      await auth.verifyEmail(sb, email, parsed.data);
      await next();
    });
  };
  return (
    <StepScreen {...frame} footer={<Button size="lg" block label={t('auth.verify')} onPress={submit} disabled={r.busy || code.length !== 6} testID="next" />}>
      <StepTitle title={t('onb.codeTitle')} subtitle={t('onb.codeText', { email })} />
      <OtpField label={t('auth.code')} value={code} onChange={setCode} />
      <FormError error={r.error} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Pressable
          disabled={cooldown.left > 0 || r.busy}
          onPress={() =>
            r.run(async () => {
              await auth.startEmail(sb, email);
              cooldown.start();
            })
          }
        >
          <AppText variant="callout" color={cooldown.left > 0 ? 'textSecondary' : 'accentText'} style={{ fontFamily: familyByWeight['700'] }}>
            {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')}
          </AppText>
        </Pressable>
        <Pressable onPress={onChangeEmail}>
          <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
            {t('auth.changeEmail')}
          </AppText>
        </Pressable>
      </View>
    </StepScreen>
  );
}

// ---------- 3. Пароль ----------
function PasswordStep({ frame, next }: { frame: Frame; next: () => void }) {
  const sb = useSupabase();
  const { colors } = useTheme();
  const r = useRunner();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const strength = passwordStrength(pw);
  const submit = () => {
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
  const tone = [colors.danger, colors.warning, colors.success][strength];
  return (
    <StepScreen {...frame} footer={<Button size="lg" block label={t('common.continue')} onPress={submit} disabled={r.busy} testID="next" />}>
      <StepTitle title={t('onb.passwordTitle')} subtitle={t('onb.passwordText')} />
      <View>
        <TextField label={t('auth.password')} value={pw} onChangeText={setPw} secureTextEntry={!show} autoComplete="new-password" error={errors.pw} style={{ paddingRight: 52 }} />
        <Pressable accessibilityRole="button" accessibilityLabel={show ? t('onb.hide') : t('onb.show')} onPress={() => setShow((v) => !v)} style={styles.eye} hitSlop={8}>
          {show ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
        </Pressable>
      </View>
      {pw ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= strength ? tone : colors.fill }} />
            ))}
          </View>
          <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
            {t(`onb.strength.${(['weak', 'medium', 'strong'] as const)[strength]}`)}
          </AppText>
        </View>
      ) : null}
      <TextField label={t('onb.passwordRepeat')} value={pw2} onChangeText={setPw2} secureTextEntry={!show} autoComplete="new-password" error={errors.pw2} />
      <FormError error={r.error} />
    </StepScreen>
  );
}

// ---------- 4. Личные данные ----------
function PersonalStep({ frame, me, next }: { frame: Frame; me: Me | null | undefined; next: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const p = me?.profile;
  const [v, setV] = useState({ firstName: p?.first_name ?? '', lastName: p?.last_name ?? '', displayName: p?.display_name ?? '', birthDate: me?.private.birth_date ?? '' });
  const [avatar, setAvatar] = useState<string | null>(p?.avatar_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, save, run } = useSaveData(next);
  const autoDisplay = [v.firstName.trim(), v.lastName.trim() ? `${v.lastName.trim()[0]}.` : ''].join(' ').trim();

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || !me) return;
    const a = res.assets[0]!;
    if ((a.fileSize ?? 0) > 5 * 1024 * 1024) return setErrors({ photo: 'errors.file_too_big_5' });
    void run(async () => {
      const body = Platform.OS === 'web' && a.file ? a.file : await (await fetch(a.uri)).arrayBuffer();
      const url = await files.uploadAvatar(sb, me.profile.id, body, a.mimeType ?? 'image/jpeg');
      await profile.saveData(sb, { avatar_url: url });
      setAvatar(url);
      await qc.invalidateQueries({ queryKey: keys.me });
    });
  };

  const submit = () => {
    const parsed = personalStepSchema.safeParse({ ...v, displayName: v.displayName || autoDisplay });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void save({ first_name: parsed.data.firstName, last_name: parsed.data.lastName, display_name: parsed.data.displayName, birth_date: parsed.data.birthDate });
  };

  return (
    <StepScreen {...frame} footer={<Button size="lg" block label={t('common.continue')} onPress={submit} disabled={busy} testID="next" />}>
      <StepTitle title={t('onb.personalTitle')} subtitle={t('onb.personalText')} />
      <Pressable accessibilityRole="button" accessibilityLabel={avatar ? t('onb.changePhoto') : t('onb.photo')} onPress={pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View>
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: 88, height: 88, borderRadius: 44 }} />
          ) : (
            <View style={[styles.avatarEmpty, { backgroundColor: colors.fill }]}>
              <Camera size={30} color={colors.textSecondary} />
            </View>
          )}
          <View style={[styles.avatarPlus, { backgroundColor: colors.ink }]}>
            <Plus size={18} strokeWidth={3} color={colors.onInk} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{avatar ? t('onb.changePhoto') : t('onb.photo')}</AppText>
          <AppText variant="callout" color="textSecondary">
            {t('onb.photoHint')}
          </AppText>
        </View>
      </Pressable>
      <FormError error={errors.photo} />
      <TextField label={t('onb.firstName')} value={v.firstName} onChangeText={(x) => setV({ ...v, firstName: x })} autoComplete="given-name" error={errors.firstName} />
      <TextField label={t('onb.lastName')} value={v.lastName} onChangeText={(x) => setV({ ...v, lastName: x })} autoComplete="family-name" error={errors.lastName} />
      <View style={{ gap: 8 }}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
          {t('onb.birthDate')}
        </AppText>
        <WheelDate value={v.birthDate} onChange={(x) => setV((s) => ({ ...s, birthDate: x }))} />
        <AppText variant="callout" color={errors.birthDate ? undefined : 'textSecondary'} style={errors.birthDate ? { color: colors.danger } : undefined}>
          {errors.birthDate ? t(errors.birthDate as TranslationKey) : t('onb.ageHint')}
        </AppText>
      </View>
      <TextField label={t('onb.displayName')} placeholder={autoDisplay} value={v.displayName} onChangeText={(x) => setV({ ...v, displayName: x })} error={errors.displayName} />
      <FormError error={error} />
    </StepScreen>
  );
}

// ---------- 5. Местоположение ----------
function LocationStep({ frame, me, next }: { frame: Frame; me: Me | null | undefined; next: () => void }) {
  const { colors } = useTheme();
  const p = me?.profile;
  const [country, setCountry] = useState(p?.country_code ?? '');
  const [city, setCity] = useState(p?.city ?? '');
  const [locale, setLocale] = useState(me?.private.locale ?? 'ru');
  const [currency, setCurrency] = useState(p?.display_currency ?? 'USD');
  const [langs, setLangs] = useState<WorkLanguage[]>(p?.languages.length ? p.languages : [{ code: 'ru', level: 'native' }]);
  const [sheet, setSheet] = useState<null | 'country' | 'lang'>(null);
  const [q, setQ] = useState('');
  const timezone = p?.timezone ?? deviceTimezone();
  const { busy, error, save } = useSaveData(next);
  const countries = useMemo(() => COUNTRY_CODES.map((c) => ({ code: c, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name, 'ru')), []);
  const filtered = countries.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <StepScreen
      {...frame}
      footer={
        <Button
          size="lg"
          block
          label={t('common.continue')}
          disabled={busy}
          testID="next"
          onPress={() => save({ country_code: country || null, city: city || null, timezone, locale, display_currency: currency, languages: langs })}
        />
      }
    >
      <StepTitle title={t('onb.locationTitle')} subtitle={t('onb.locationText')} />
      <ListGroup>
        <ListRow title={t('onb.country')} value={country ? countryName(country) : t('onb.chooseCountry')} onPress={() => setSheet('country')} testID="country" />
        <ListRow title={t('onb.timezone')} value={timezone} />
      </ListGroup>
      <TextField label={t('onb.city')} value={city} onChangeText={setCity} autoComplete="postal-address-locality" />
      <View style={{ gap: 10 }}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
          {t('onb.uiLanguage')}
        </AppText>
        <View style={styles.wrap}>
          {LOCALES.map((l) => (
            <Pill key={l} label={LOCALE_NAMES[l]} selected={locale === l} onPress={() => setLocale(l)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
          {t('onb.workLanguages')}
        </AppText>
        {langs.map((l, i) => (
          <View key={l.code} style={[styles.langRow, { backgroundColor: colors.fill }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="bodyStrong">{languageName(l.code)}</AppText>
              <Pressable accessibilityLabel={t('common.remove')} onPress={() => setLangs(langs.filter((_, j) => j !== i))} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.wrap}>
              {LANGUAGE_LEVELS.map((lv) => (
                <Pill key={lv} label={t(`onb.levels.${lv}`)} selected={l.level === lv} onPress={() => setLangs(langs.map((x, j) => (j === i ? { ...x, level: lv } : x)))} />
              ))}
            </View>
          </View>
        ))}
        <Pressable onPress={() => setSheet('lang')} disabled={langs.length >= 10} style={[styles.addRow, { backgroundColor: colors.fill }]}>
          <Plus size={18} color={colors.text} />
          <AppText variant="bodyStrong">{t('onb.addLanguage')}</AppText>
        </Pressable>
      </View>
      <View style={{ gap: 10 }}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
          {t('onb.currency')}
        </AppText>
        <View style={styles.wrap}>
          {DISPLAY_CURRENCIES.map((c) => (
            <Pill key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </View>
      </View>
      <FormError error={error} />
      <BottomSheet open={sheet === 'country'} onClose={() => setSheet(null)} title={t('onb.country')}>
        <TextField label={t('common.search')} value={q} onChangeText={setQ} />
        {filtered.slice(0, 60).map((c) => (
          <OptionTile
            key={c.code}
            title={c.name}
            selected={country === c.code}
            onPress={() => {
              setCountry(c.code);
              setSheet(null);
              setQ('');
            }}
          />
        ))}
      </BottomSheet>
      <BottomSheet open={sheet === 'lang'} onClose={() => setSheet(null)} title={t('onb.addLanguage')}>
        {WORK_LANGUAGES.filter((c) => !langs.some((l) => l.code === c)).map((c) => (
          <OptionTile
            key={c}
            title={languageName(c)}
            onPress={() => {
              setLangs([...langs, { code: c, level: 'b1' }]);
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>
    </StepScreen>
  );
}

// ---------- 6. Профессия ----------
function ProfessionStep({ frame, me, next }: { frame: Frame; me: Me | null | undefined; next: () => void }) {
  const { colors } = useTheme();
  const p = me?.profile;
  const known = PROFESSIONS.find((x) => professionLabel(x.id) === p?.profession);
  const [selected, setSelected] = useState<string | null>(known?.id ?? null);
  const [custom, setCustom] = useState(known || !p?.profession ? '' : p.profession);
  const [showCustom, setShowCustom] = useState(!!custom);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<ExperienceLevel | null>(p?.experience_level ?? null);
  const { busy, error, save } = useSaveData(next);
  const name = showCustom ? custom.trim() : selected ? professionLabel(selected) : '';
  const list = PROFESSIONS.filter((x) => !query || professionLabel(x.id).toLowerCase().includes(query.toLowerCase()));
  return (
    <StepScreen
      {...frame}
      footer={<Button size="lg" block label={t('common.next')} disabled={busy || !name} testID="next" onPress={() => save({ profession: name, headline: name, experience_level: level })} />}
    >
      <StepTitle title={t('onb.professionTitle')} subtitle={t('onb.professionText')} />
      <TextField label={t('onb.professionSearch')} value={query} onChangeText={setQuery} />
      <View style={{ gap: 8 }}>
        {list.map((x) => {
          const Icon = categoryIcon(x.category);
          return (
            <OptionTile
              key={x.id}
              title={professionLabel(x.id)}
              selected={!showCustom && selected === x.id}
              icon={(c) => <Icon size={20} strokeWidth={2.4} color={c} />}
              onPress={() => {
                setSelected(x.id);
                setShowCustom(false);
              }}
            />
          );
        })}
      </View>
      {showCustom ? (
        <TextField label={t('onb.professionCustom')} placeholder={t('onb.professionCustomPlaceholder')} value={custom} onChangeText={setCustom} maxLength={80} autoFocus />
      ) : (
        <Pressable onPress={() => setShowCustom(true)}>
          <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
            + {t('onb.professionCustom')}
          </AppText>
        </Pressable>
      )}
      <View style={{ gap: 8 }}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'], color: colors.text }}>
          {t('onb.experience')}
        </AppText>
        {EXPERIENCE_LEVELS.map((lv) => (
          <OptionTile key={lv} title={t(`onb.exp.${lv}`)} subtitle={t(`onb.expHint.${lv}`)} selected={level === lv} onPress={() => setLevel(lv)} />
        ))}
      </View>
      <FormError error={error} />
    </StepScreen>
  );
}

// ---------- 7. Навыки ----------
function SkillsStep({ frame, me, next }: { frame: Frame; me: Me | null | undefined; next: () => void }) {
  const { colors } = useTheme();
  const catalog = useSkills();
  const [selected, setSelected] = useState<string[]>(me?.skills ?? []);
  const [custom, setCustom] = useState<string[]>(me?.profile.custom_skills ?? []);
  const [customText, setCustomText] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(24);
  const { busy, error, save } = useSaveData(next);
  const recommended = PROFESSIONS.find((x) => professionLabel(x.id) === me?.profile.profession)?.skills ?? [];
  const total = selected.length + custom.length;
  const toggle = (slug: string) => setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : total >= SKILLS_MAX ? s : [...s, slug]));
  const all = (catalog.data ?? []).filter((s) => !recommended.includes(s.slug)).filter((s) => !query || skillLabel(s.slug).toLowerCase().includes(query.toLowerCase()));
  return (
    <StepScreen
      {...frame}
      footer={<Button size="lg" block label={t('common.next')} disabled={busy || total < SKILLS_MIN} testID="next" onPress={() => save({ skills: selected, custom_skills: custom })} />}
    >
      <StepTitle title={t('onb.skillsTitle')} subtitle={t('onb.skillsText')} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="callout" tabular style={{ fontFamily: familyByWeight['700'], color: total < SKILLS_MIN ? colors.textSecondary : colors.success }}>
          {t('onb.selected', { n: total })}
        </AppText>
        {total > 0 ? (
          <Pressable
            onPress={() => {
              setSelected([]);
              setCustom([]);
            }}
          >
            <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
              {t('onb.clearAll')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <TextField label={t('onb.skillsSearch')} value={query} onChangeText={setQuery} />
      {recommended.length > 0 && !query ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} color={colors.accent} />
            <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
              {t('onb.recommended')}
            </AppText>
          </View>
          <View style={styles.wrap}>
            {recommended.map((s) => (
              <SkillChip key={s} label={skillLabel(s)} selected={selected.includes(s)} onPress={() => toggle(s)} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
          {t('onb.allSkills')}
        </AppText>
        <View style={styles.wrap}>
          {all.slice(0, limit).map((s) => (
            <SkillChip key={s.slug} label={skillLabel(s.slug)} selected={selected.includes(s.slug)} onPress={() => toggle(s.slug)} />
          ))}
        </View>
        {all.length > limit ? (
          <Pressable onPress={() => setLimit((l) => l + 24)}>
            <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
              {t('onb.showMore')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: 10 }}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
          {t('onb.addCustom')}
        </AppText>
        {custom.length > 0 ? (
          <View style={styles.wrap}>
            {custom.map((c) => (
              <SkillChip key={c} label={`${c}  ✕`} selected onPress={() => setCustom(custom.filter((x) => x !== c))} />
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            accessibilityLabel={t('onb.customPlaceholder')}
            placeholder={t('onb.customPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={customText}
            onChangeText={setCustomText}
            maxLength={40}
            style={[styles.inlineInput, { backgroundColor: colors.fill, color: colors.text }]}
          />
          <Button
            variant="glass"
            size="icon"
            accessibilityLabel={t('onb.addCustom')}
            icon={<Plus size={20} color={colors.text} />}
            disabled={!customText.trim() || custom.length >= 10 || total >= SKILLS_MAX}
            onPress={() => {
              const v = customText.trim();
              if (v && !custom.includes(v)) setCustom([...custom, v]);
              setCustomText('');
            }}
          />
        </View>
      </View>
      <FormError error={error} />
    </StepScreen>
  );
}

// ---------- 8. О себе ----------
function AboutStep({ frame, me, next }: { frame: Frame; me: Me | null | undefined; next: () => void }) {
  const { colors } = useTheme();
  const p = me?.profile;
  const [bio, setBio] = useState(p?.bio ?? '');
  const [links, setLinks] = useState(p?.links ?? []);
  const [exp, setExp] = useState<{ company: string; position: string; from_year: number | null; to_year: number | null }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, save } = useSaveData(next);
  const aiWrite = () => {
    const skills = [...(me?.skills ?? []).map(skillLabel), ...(p?.custom_skills ?? [])].slice(0, 5).join(', ');
    setBio(t('onb.bioTemplate', { profession: p?.profession ?? t('profession.student'), skills: skills || '—' }));
  };
  const submit = () => {
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
    <StepScreen
      {...frame}
      footer={
        <>
          <Button size="lg" block label={t('common.continue')} onPress={submit} disabled={busy} testID="next" />
          <Button variant="glass" block label={t('common.skip')} onPress={next} />
        </>
      }
    >
      <StepTitle title={t('onb.aboutTitle')} subtitle={t('onb.aboutText')} />
      <TextField label={t('onb.bio')} placeholder={t('onb.bioPlaceholder')} value={bio} onChangeText={setBio} multiline counterMax={1000} error={errors.bio} />
      <Pressable onPress={aiWrite} style={[styles.pill, { alignSelf: 'flex-start', backgroundColor: colors.accentSoft, gap: 6, flexDirection: 'row' }]}>
        <Sparkles size={16} color={colors.accentText} />
        <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
          {t('onb.aiWrite')}
        </AppText>
      </Pressable>
      {links.map((l, i) => (
        <Card key={i} style={{ padding: 14, gap: 10 }}>
          <TextField label={t('onb.linkTitle')} value={l.title} onChangeText={(x) => setLinks(links.map((y, j) => (j === i ? { ...y, title: x } : y)))} />
          <TextField label={t('onb.linkUrl')} value={l.url} autoCapitalize="none" keyboardType="url" placeholder="https://" onChangeText={(x) => setLinks(links.map((y, j) => (j === i ? { ...y, url: x } : y)))} />
          <Pressable onPress={() => setLinks(links.filter((_, j) => j !== i))}>
            <AppText variant="callout" style={{ color: colors.danger, fontFamily: familyByWeight['700'] }}>
              {t('common.remove')}
            </AppText>
          </Pressable>
        </Card>
      ))}
      {exp.map((x, i) => (
        <Card key={`e${i}`} style={{ padding: 14, gap: 10 }}>
          <TextField label={t('onb.company')} value={x.company} onChangeText={(v) => setExp(exp.map((y, j) => (j === i ? { ...y, company: v } : y)))} />
          <TextField label={t('onb.position')} value={x.position} onChangeText={(v) => setExp(exp.map((y, j) => (j === i ? { ...y, position: v } : y)))} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextField label={t('onb.fromYear')} keyboardType="number-pad" value={x.from_year ? String(x.from_year) : ''} onChangeText={(v) => setExp(exp.map((y, j) => (j === i ? { ...y, from_year: Number(v) || null } : y)))} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={t('onb.toYear')} keyboardType="number-pad" value={x.to_year ? String(x.to_year) : ''} onChangeText={(v) => setExp(exp.map((y, j) => (j === i ? { ...y, to_year: Number(v) || null } : y)))} />
            </View>
          </View>
          <Pressable onPress={() => setExp(exp.filter((_, j) => j !== i))}>
            <AppText variant="callout" style={{ color: colors.danger, fontFamily: familyByWeight['700'] }}>
              {t('common.remove')}
            </AppText>
          </Pressable>
        </Card>
      ))}
      <View style={styles.wrap}>
        <Pressable onPress={() => setLinks([...links, { title: '', url: '' }])} style={[styles.addRow, { backgroundColor: colors.fill }]}>
          <Link size={18} color={colors.text} />
          <AppText variant="bodyStrong">{t('onb.addLink')}</AppText>
        </Pressable>
        <Pressable onPress={() => setExp([...exp, { company: '', position: '', from_year: null, to_year: null }])} style={[styles.addRow, { backgroundColor: colors.fill }]}>
          <Briefcase size={18} color={colors.text} />
          <AppText variant="bodyStrong">{t('onb.addExperience')}</AppText>
        </Pressable>
      </View>
      <FormError error={error} />
    </StepScreen>
  );
}

// ---------- 9. Образование ----------
function EducationStep({ frame, me, next }: { frame: Frame; me: Me | null | undefined; next: () => void }) {
  const { colors } = useTheme();
  const p = me?.profile;
  const [query, setQuery] = useState('');
  const [uni, setUni] = useState<{ id: number; name: string } | null>(me?.university ? { id: me.university.id, name: me.university.name } : null);
  const [faculty, setFaculty] = useState(p?.faculty ?? '');
  const [specialty, setSpecialty] = useState(p?.specialty ?? '');
  const [studentEmail, setStudentEmail] = useState(me?.private.student_email ?? '');
  const search = useUniversitySearch(uni ? '' : query);
  const { busy, error, save } = useSaveData(next);
  return (
    <StepScreen
      {...frame}
      footer={
        <>
          <Button
            size="lg"
            block
            label={t('onb.addAndContinue')}
            disabled={busy || !uni}
            testID="next"
            onPress={() => save({ university_id: uni?.id ?? null, faculty: faculty || null, specialty: specialty || null, student_email: studentEmail || null })}
          />
          <Button variant="glass" block label={t('common.skip')} onPress={next} testID="skip" />
        </>
      }
    >
      <StepTitle title={t('onb.eduTitle')} subtitle={t('onb.eduText')} />
      {uni ? (
        <OptionTile selected title={uni.name} subtitle={t('common.edit')} icon={(c) => <GraduationCap size={20} color={c} />} onPress={() => setUni(null)} />
      ) : (
        <View style={{ gap: 8 }}>
          <TextField label={t('onb.university')} placeholder={t('onb.universitySearch')} value={query} onChangeText={setQuery} />
          {(search.data ?? []).slice(0, 6).map((u) => (
            <OptionTile key={u.id} title={u.name} subtitle={countryName(u.country_code)} icon={(c) => <GraduationCap size={20} color={c} />} onPress={() => setUni({ id: u.id, name: u.name })} />
          ))}
        </View>
      )}
      <TextField label={t('onb.faculty')} value={faculty} onChangeText={setFaculty} maxLength={120} />
      <TextField label={t('onb.specialty')} value={specialty} onChangeText={setSpecialty} maxLength={120} />
      <TextField label={t('onb.studentEmail')} value={studentEmail} onChangeText={setStudentEmail} autoCapitalize="none" keyboardType="email-address" />
      <FormError error={error} />
      <View style={{ height: 1, backgroundColor: colors.separator, opacity: 0 }} />
    </StepScreen>
  );
}

// ---------- 10. Безопасность ----------
function SecurityStep({ frame, me, next, goTo, name }: { frame: Frame; me: Me | null | undefined; next: () => void; goTo: (s: StepId) => void; name: string }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const r = useRunner();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const p = me?.profile;
  const skills = [...(me?.skills ?? []).map(skillLabel), ...(p?.custom_skills ?? [])];
  const edit = (s: StepId) => (
    <Pressable onPress={() => goTo(s)} hitSlop={8}>
      <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
        {t('common.edit')}
      </AppText>
    </Pressable>
  );
  return (
    <StepScreen
      {...frame}
      footer={
        <Button
          size="lg"
          block
          label={t('onb.confirm')}
          disabled={r.busy || !terms || !privacy}
          testID="next"
          onPress={() =>
            r.run(async () => {
              await profile.complete(sb, { terms, privacy, twoFactor, notifications });
              await qc.invalidateQueries({ queryKey: keys.me });
              next();
            })
          }
        />
      }
    >
      <StepTitle title={t('onb.securityTitle')} subtitle={t('onb.securityText')} />
      <ListGroup>
        <ListRow title={t('onb.sumName')} subtitle={name || t('onb.none')} trailing={edit('personal')} />
        <ListRow title={t('onb.sumLocation')} subtitle={[p?.city, p?.country_code ? countryName(p.country_code) : null].filter(Boolean).join(', ') || t('onb.none')} trailing={edit('location')} />
        <ListRow title={t('onb.sumProfession')} subtitle={[p?.profession, p?.experience_level ? t(`onb.exp.${p.experience_level}`) : null].filter(Boolean).join(' · ') || t('onb.none')} trailing={edit('profession')} />
        <ListRow title={t('onb.sumSkills')} subtitle={skills.join(', ') || t('onb.none')} trailing={edit('skills')} />
        <ListRow title={t('onb.sumEducation')} subtitle={me?.university?.name ?? t('onb.none')} trailing={edit('education')} />
      </ListGroup>
      <ListGroup>
        <ListRow title={t('onb.twoFactor')} subtitle={t('onb.twoFactorHint')} trailing={<Toggle value={twoFactor} onChange={setTwoFactor} label={t('onb.twoFactor')} />} />
        <ListRow title={t('onb.notifications')} subtitle={t('onb.notificationsHint')} trailing={<Toggle value={notifications} onChange={setNotifications} label={t('onb.notifications')} />} />
      </ListGroup>
      <Checkbox checked={terms} onChange={setTerms} label={t('onb.agreeTerms')} testID="agree-terms" />
      <Checkbox checked={privacy} onChange={setPrivacy} label={t('onb.agreePrivacy')} testID="agree-privacy" />
      <FormError error={r.error} />
    </StepScreen>
  );
}

// ---------- 11. Готово ----------
function DoneStep() {
  const { colors } = useTheme();
  const feed = useFeed({ kind: 'online', sort: 'recommended' }, null);
  const tasks = (feed.data?.pages.flat() ?? []).slice(0, 3);
  return (
    <StepScreen
      stepKey="done"
      footer={
        <>
          <Button size="lg" block label={t('onb.toTasks')} onPress={() => router.replace('/feed')} testID="to-tasks" />
          <Button variant="glass" size="lg" block label={t('onb.openProfile')} onPress={() => router.replace('/account')} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 16, paddingTop: 24 }}>
        <View style={[styles.doneIcon, { backgroundColor: colors.accent }]}>
          <CircleCheck size={48} strokeWidth={2.4} color={colors.onAccent} />
        </View>
        <AppText variant="title1" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('onb.doneTitle')}
        </AppText>
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {t('onb.doneText')}
        </AppText>
      </View>
      {(['how1', 'how2', 'how3'] as const).map((k, i) => (
        <View key={k} style={[styles.how, { backgroundColor: colors.fill }]}>
          <View style={[styles.howNum, { backgroundColor: colors.ink }]}>
            <AppText variant="bodyStrong" style={{ color: colors.onInk, fontFamily: familyByWeight['800'] }}>
              {i + 1}
            </AppText>
          </View>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {t(`onb.${k}`)}
          </AppText>
        </View>
      ))}
      {tasks.length > 0 ? (
        <View style={{ gap: 12 }}>
          <AppText variant="title3">{t('onb.firstTasks')}</AppText>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={{ id: task.id, title: task.title, rewardCents: task.reward_cents, kind: task.kind, category: task.category, deadline: task.deadline }}
              onPress={() => router.replace(`/task/${task.id}`)}
            />
          ))}
        </View>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { height: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 44, paddingHorizontal: 16, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroCard: { position: 'absolute', left: 24, right: 24, top: 0, borderRadius: 24, borderWidth: 1, padding: 16, gap: 10 },
  heroIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  eye: { position: 'absolute', right: 14, top: 44 },
  avatarEmpty: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarPlus: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  langRow: { borderRadius: 18, padding: 14, gap: 10 },
  addRow: { height: 48, paddingHorizontal: 16, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  inlineInput: { flex: 1, height: 48, borderRadius: 18, paddingHorizontal: 16, fontSize: 17, fontFamily: 'Manrope_500Medium' },
  doneIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 12px 32px rgba(255,84,40,0.4)' },
  how: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16 },
  howNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
