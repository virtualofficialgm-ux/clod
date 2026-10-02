import {
  accountSchema,
  auth,
  CATEGORIES,
  fieldErrors,
  otpSchema,
  profile,
  profileStepSchema,
  t,
  type TranslationKey,
  type University,
} from '@parri/shared';
import { keys, useMe, useSession, useSkills, useSupabase, useUniversitySearch } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { X } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { BackButton } from '@/components/ui/BackButton';
import { OtpField } from '@/components/ui/OtpField';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Card, Center, Label, PageTitle, Row } from '@/components/ui/bits';
import { useCooldown, useRunner } from '@/lib/useRunner';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

const STEPS = ['stepAccount', 'stepProfile', 'stepSkills', 'stepDone'] as const;

function Stepper({ current }: { current: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={t('register.title')}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ flex: 1, gap: 6 }} accessibilityState={{ selected: i === current }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: i <= current ? colors.accent : colors.separator }} />
          <AppText variant="caption" color={i === current ? 'text' : 'textSecondary'} numberOfLines={1}>
            {t(`register.${s}`)}
          </AppText>
        </View>
      ))}
    </View>
  );
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

  if (sent) {
    return (
      <Card>
        <AppText variant="title3">{t('register.codeTitle')}</AppText>
        <AppText variant="body" color="textSecondary">
          {t('auth.codeSent', { email })}
        </AppText>
        <OtpField label={t('auth.code')} value={code} onChange={setCode} />
        <FormError error={error ?? errors.code} />
        <Button
          size="lg"
          block
          label={t('auth.verify')}
          disabled={busy || code.length !== 6}
          onPress={() => {
            const parsed = otpSchema.safeParse(code);
            if (!parsed.success) return setErrors({ code: parsed.error.issues[0]!.message });
            void run(async () => {
              await auth.verifySignup(sb, email.trim().toLowerCase(), parsed.data);
              await qc.invalidateQueries({ queryKey: keys.me });
            });
          }}
        />
        <Button
          variant="glass"
          block
          disabled={cooldown.left > 0 || busy}
          label={cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')}
          onPress={() => run(async () => { await auth.resendSignup(sb, email); cooldown.start(); })}
        />
        <Button variant="glass" block label={t('auth.changeEmail')} onPress={() => setSent(false)} />
      </Card>
    );
  }
  return (
    <Card>
      <AppText variant="title3">{t('register.accountTitle')}</AppText>
      <AppText variant="body" color="textSecondary">
        {t('register.accountText')}
      </AppText>
      <TextField label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
      <TextField label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} hint={t('auth.passwordHint')} />
      <FormError error={error} />
      <Button
        size="lg"
        block
        label={t('common.next')}
        disabled={busy}
        onPress={() => {
          const parsed = accountSchema.safeParse({ email, password });
          if (!parsed.success) return setErrors(fieldErrors(parsed.error));
          setErrors({});
          void run(async () => {
            await auth.signUp(sb, parsed.data.email, parsed.data.password);
            setSent(true);
            cooldown.start();
          });
        }}
      />
    </Card>
  );
}

function ProfileStep() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [v, setV] = useState({ firstName: '', lastName: '', birthDate: '', phone: '', locale: 'ru' as const });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, run } = useRunner();
  const set = (k: keyof typeof v) => (text: string) => setV({ ...v, [k]: text });
  return (
    <Card>
      <AppText variant="title3">{t('register.profileTitle')}</AppText>
      <TextField label={t('register.firstName')} value={v.firstName} onChangeText={set('firstName')} autoComplete="given-name" error={errors.firstName} />
      <TextField label={t('register.lastName')} value={v.lastName} onChangeText={set('lastName')} autoComplete="family-name" error={errors.lastName} />
      <TextField
        label={t('register.birthDate')}
        value={v.birthDate}
        onChangeText={set('birthDate')}
        placeholder="2006-05-14"
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
        hint={t('register.ageHint')}
        error={errors.birthDate}
      />
      <TextField label={t('register.phone')} value={v.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="+7 999 123-45-67" error={errors.phone} />
      <Label>{t('register.language')}</Label>
      <Row>
        <Chip label={t('register.ru')} selected />
      </Row>
      <FormError error={error} />
      <Button
        size="lg"
        block
        label={t('common.next')}
        disabled={busy}
        onPress={() => {
          const parsed = profileStepSchema.safeParse(v);
          if (!parsed.success) return setErrors(fieldErrors(parsed.error));
          setErrors({});
          void run(async () => {
            await profile.saveProfile(sb, parsed.data);
            await qc.invalidateQueries({ queryKey: keys.me });
          });
        }}
      />
    </Card>
  );
}

function UniversityPicker({ value, onChange }: { value: University | null; onChange: (u: University | null) => void }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const { data = [] } = useUniversitySearch(q);
  if (value) {
    return (
      <View style={{ gap: 8 }}>
        <Label>{t('register.university')}</Label>
        <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {value.name} · {value.country}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} onPress={() => onChange(null)} hitSlop={12}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Card>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <TextField label={t('register.university')} placeholder={t('register.universityPlaceholder')} value={q} onChangeText={setQ} hint={t('register.universityHint')} />
      {data.slice(0, 8).map((u) => (
        <Pressable key={u.id} accessibilityRole="button" onPress={() => onChange(u)}>
          <Card style={{ padding: 14 }}>
            <AppText variant="bodyStrong">{u.name}</AppText>
            <AppText variant="caption" color="textSecondary">
              {u.country}
            </AppText>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function SkillsStep() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { data: skills = [] } = useSkills();
  const [selected, setSelected] = useState<string[]>([]);
  const [uni, setUni] = useState<University | null>(null);
  const { busy, error, run } = useRunner();
  const grouped = useMemo(() => CATEGORIES.map((c) => ({ c, items: skills.filter((s) => s.category === c) })).filter((g) => g.items.length), [skills]);
  return (
    <Card>
      <AppText variant="title3">{t('register.skillsTitle')}</AppText>
      <AppText variant="body" color="textSecondary">
        {t('register.skillsText')}
      </AppText>
      {grouped.map(({ c, items }) => (
        <View key={c} style={{ gap: 8 }}>
          <Label>{t(`category.${c}`)}</Label>
          <Row>
            {items.map((s) => (
              <Chip
                key={s.slug}
                label={t(`skill.${s.slug}` as TranslationKey)}
                selected={selected.includes(s.slug)}
                onPress={() => setSelected((p) => (p.includes(s.slug) ? p.filter((x) => x !== s.slug) : [...p, s.slug]))}
              />
            ))}
          </Row>
        </View>
      ))}
      <UniversityPicker value={uni} onChange={setUni} />
      <FormError error={error} />
      <Button
        size="lg"
        block
        label={t('common.next')}
        disabled={busy}
        onPress={() =>
          run(async () => {
            await profile.saveSkills(sb, selected, uni?.id ?? null);
            await qc.invalidateQueries({ queryKey: keys.me });
          })
        }
      />
    </Card>
  );
}

export default function Register() {
  const { session, loading } = useSession();
  const me = useMe(!!session);
  const onboarding = me.data?.profile.onboarding;
  const step = !session ? 0 : onboarding === 'profile' ? 1 : onboarding === 'skills' ? 2 : 3;

  return (
    <Screen title={t('register.title')} leading={<BackButton />}>
      <PageTitle>{t('register.title')}</PageTitle>
      <Stepper current={step} />
      {loading || (session && me.isLoading) ? (
        <Center />
      ) : step === 0 ? (
        <AccountStep />
      ) : step === 1 ? (
        <ProfileStep />
      ) : step === 2 ? (
        <SkillsStep />
      ) : (
        <Card>
          <AppText variant="title1">{t('register.doneTitle')}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('register.doneText')}
          </AppText>
          <Button size="lg" block label={t('register.toFeed')} onPress={() => router.replace('/feed')} />
        </Card>
      )}
      {step === 0 && (
        <View style={{ alignItems: 'center' }}>
          <AppText variant="body" color="textSecondary" style={{ fontFamily: familyByWeight['400'] }}>
            {t('auth.haveAccount')}
          </AppText>
          <Button variant="glass" label={t('auth.submit')} onPress={() => router.replace('/login')} />
        </View>
      )}
    </Screen>
  );
}
