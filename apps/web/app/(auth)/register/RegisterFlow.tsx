'use client';

import { SKILLS_MIN, t, type ExperienceLevel, type Me } from '@parri/shared';
import { useMe, useSession } from '@parri/shared/react';
import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CenterSpinner } from '@/components/ui/bits';
import { StepHeader } from '@/components/ui/kit';
import { springs } from '@/lib/springs';
import {
  AboutStep,
  CodeStep,
  DoneStep,
  EducationStep,
  EmailStep,
  LocationStep,
  PasswordStep,
  PersonalStep,
  ProfessionStep,
  ProfilePreview,
  SecurityStep,
  SkillsStep,
  StartStep,
  type StepId,
} from './steps';

const ORDER: StepId[] = ['start', 'email', 'code', 'password', 'personal', 'location', 'profession', 'skills', 'about', 'education', 'security', 'done'];
/** Этапы на шкале сверху: аккаунт, профиль, навыки, безопасность, готово */
const PHASE: Record<StepId, 'account' | 'profile' | 'skills' | 'security' | 'done'> = {
  start: 'account', email: 'account', code: 'account', password: 'account',
  personal: 'profile', location: 'profile', profession: 'profile',
  skills: 'skills', about: 'skills', education: 'skills',
  security: 'security', done: 'done',
};
const PREVIEW_STEPS = new Set<StepId>(['profession', 'skills', 'about']);

/** Первый незаполненный шаг для вошедшего, но не закончившего регистрацию */
function resumeStep(me: Me): StepId {
  const p = me.profile;
  if (!p.first_name || !p.last_name || !me.private.birth_date) return 'personal';
  if (!p.country_code && !p.city) return 'location';
  if (!p.profession) return 'profession';
  if (me.skills.length + p.custom_skills.length < SKILLS_MIN) return 'skills';
  return 'about';
}

export function RegisterFlow() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { session, loading } = useSession();
  const me = useMe(!!session);
  const [step, setStep] = useState<StepId | null>(null);
  const [dir, setDir] = useState(1);
  const [email, setEmail] = useState('');
  const [preview, setPreview] = useState<{ profession?: string; level?: ExperienceLevel | null; skills?: string[] }>({});

  // Начальный шаг: гость — старт; вошёл и закончил — дашборд; иначе — с места, где остановился
  useEffect(() => {
    if (step || loading) return;
    if (!session) return setStep('start');
    if (me.isLoading || !me.data) return;
    if (me.data.profile.onboarding === 'done') router.replace('/dashboard');
    else setStep(resumeStep(me.data));
  }, [step, loading, session, me.isLoading, me.data, router]);

  const go = (to: StepId) => {
    setDir(ORDER.indexOf(to) >= ORDER.indexOf(step ?? 'start') ? 1 : -1);
    setStep(to);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };
  const next = () => go(ORDER[ORDER.indexOf(step!) + 1]!);
  const back = () => {
    const i = ORDER.indexOf(step!);
    // После входа по коду назад к email/коду не возвращаемся
    const min = session ? ORDER.indexOf('personal') : 0;
    if (i > min) go(ORDER[i - 1]!);
  };

  if (!step) return <CenterSpinner />;

  const index = ORDER.indexOf(step);
  const canBack = step !== 'done' && step !== 'start' && !(session && index <= ORDER.indexOf('personal')) && step !== 'password';
  const props = { me: me.data, next, goTo: go };
  const wide = PREVIEW_STEPS.has(step);

  const body = (() => {
    switch (step) {
      case 'start':
        return <StartStep {...props} />;
      case 'email':
        return <EmailStep {...props} email={email} setEmail={setEmail} />;
      case 'code':
        return <CodeStep {...props} email={email} onChangeEmail={() => go('email')} onExisting={() => router.replace('/dashboard')} />;
      case 'password':
        return <PasswordStep {...props} />;
      case 'personal':
        return <PersonalStep {...props} />;
      case 'location':
        return <LocationStep {...props} />;
      case 'profession':
        return <ProfessionStep {...props} onPreview={(v) => setPreview((p) => ({ ...p, ...v }))} />;
      case 'skills':
        return <SkillsStep {...props} onPreview={(skills) => setPreview((p) => ({ ...p, skills }))} />;
      case 'about':
        return <AboutStep {...props} />;
      case 'education':
        return <EducationStep {...props} />;
      case 'security':
        return <SecurityStep {...props} />;
      case 'done':
        return <DoneStep onFinish={(to) => router.replace(to)} />;
    }
  })();

  return (
    <div data-wide={wide || undefined} className="flex min-h-[calc(100dvh-140px)] flex-1 flex-col gap-6">
      {step !== 'start' && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-caption uppercase text-text-2">{t(`onb.phases.${PHASE[step]}`)}</p>
          <StepHeader step={index} total={ORDER.length - 1} onBack={canBack ? back : undefined} />
        </div>
      )}
      <div className={clsx('flex flex-1 gap-10', wide && 'md:grid md:grid-cols-[minmax(0,1fr)_340px]')}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
            transition={springs.appear}
            className="flex min-w-0 flex-1 flex-col"
          >
            {body}
          </motion.div>
        </AnimatePresence>
        {wide && (
          <aside className="hidden md:block">
            <div className="sticky top-8">
              <ProfilePreview me={me.data} profession={preview.profession} level={preview.level} skills={preview.skills} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
