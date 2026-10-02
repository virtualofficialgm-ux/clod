'use client';

import { motion } from 'framer-motion';
import { Bell, ChevronLeft, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  CATEGORIES,
  SORTS,
  TASK_KINDS,
  priceBreakdown,
  formatMoney,
  showcaseTasks,
  t,
  type Category,
  type FeedSort,
  type TaskKind,
} from '@parri/shared';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { TaskCard } from '@/components/task/TaskCard';
import { usePrefs, type ThemePref } from '@/lib/prefs';
import { springs } from '@/lib/springs';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.appear}
      className="flex flex-col gap-4"
    >
      <h2 className="text-title2 font-extrabold">{title}</h2>
      {children}
    </motion.section>
  );
}

export function Showcase() {
  const prefs = usePrefs();
  const [kind, setKind] = useState<TaskKind>('online');
  const [categories, setCategories] = useState<Category[]>(['design']);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<FeedSort>('recommended');
  const [budget, setBudget] = useState(0);

  const toggleCategory = (c: Category) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const sample = priceBreakdown(2500);

  return (
    <>
      <Header
        title={t('showcase.title')}
        leading={
          <Button variant="glass" size="icon" aria-label={t('showcase.back')}>
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
        actions={
          <Button variant="glass" size="icon" aria-label={t('showcase.notifications')}>
            <Bell size={20} strokeWidth={2.4} />
          </Button>
        }
      />

      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-14 px-[var(--p-gutter)] pt-6 md:px-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-display font-extrabold">
            {t('showcase.title')}
            <span className="text-accent">.</span>
          </h1>
          <p className="max-w-xl text-title3 font-semibold text-text-2">{t('showcase.subtitle')}</p>
        </div>

        <Section title={t('showcase.controls')}>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<ThemePref>
              label={t('common.theme')}
              value={prefs.theme}
              onChange={(theme) => prefs.set({ theme })}
              options={[
                { value: 'system', label: t('common.themeSystem') },
                { value: 'light', label: t('common.themeLight') },
                { value: 'dark', label: t('common.themeDark') },
              ]}
            />
            <Chip
              selected={prefs.transparency === 'reduce'}
              onClick={() =>
                prefs.set({ transparency: prefs.transparency === 'reduce' ? 'system' : 'reduce' })
              }
            >
              {t('showcase.reduceTransparency')}
            </Chip>
            <Chip
              selected={prefs.motion === 'reduce'}
              onClick={() => prefs.set({ motion: prefs.motion === 'reduce' ? 'system' : 'reduce' })}
            >
              {t('showcase.reduceMotion')}
            </Chip>
          </div>
          <p className="max-w-2xl text-callout text-text-2">{t('showcase.a11yNote')}</p>
        </Section>

        <Section title={t('showcase.typography')}>
          <div className="card flex flex-col gap-4 p-6">
            <p className="text-display font-extrabold">{t('app.tagline')}</p>
            <p className="text-title1 font-extrabold">{t('nav.feed')}</p>
            <p className="text-title2 font-extrabold">{t('kind.campus')}</p>
            <p className="text-title3 font-bold">{t('showcase.sampleTitle1')}</p>
            <p className="tabular text-price font-extrabold text-accent-text">
              {formatMoney(sample.total)}
            </p>
            <p className="max-w-2xl text-body">{t('fees.rule')}</p>
            <p className="text-caption uppercase tracking-wide text-text-2">{t('safe.name')}</p>
          </div>
        </Section>

        <Section title={t('showcase.buttons')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">{t('showcase.primary')}</Button>
            <Button>{t('showcase.primary')}</Button>
            <Button variant="glass">{t('showcase.secondary')}</Button>
            <Button disabled>{t('showcase.disabled')}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="glass" size="icon" aria-label={t('common.search')}>
              <Search size={20} strokeWidth={2.4} />
            </Button>
            <Button
              variant="glass"
              size="icon"
              aria-label={t('common.filters')}
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontal size={20} strokeWidth={2.4} />
            </Button>
            <Button variant="glass" size="icon" aria-label={t('showcase.notifications')}>
              <Bell size={20} strokeWidth={2.4} />
            </Button>
          </div>
        </Section>

        <Section title={t('showcase.segmented')}>
          <div>
            <Segmented<TaskKind>
              label={t('showcase.segmented')}
              value={kind}
              onChange={setKind}
              options={TASK_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
            />
          </div>
        </Section>

        <Section title={t('showcase.chips')}>
          <div className="-mx-[var(--p-gutter)] flex gap-2 overflow-x-auto px-[var(--p-gutter)] pb-2 md:mx-0 md:flex-wrap md:px-0">
            <Chip icon={<SlidersHorizontal size={16} strokeWidth={2.6} />} onClick={() => setSheetOpen(true)}>
              {t('common.filters')}
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} selected={categories.includes(c)} onClick={() => toggleCategory(c)}>
                {t(`category.${c}`)}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={t('showcase.cards')}>
          <div className="grid gap-4 md:grid-cols-2">
            {showcaseTasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => {}} />
            ))}
          </div>
        </Section>

        <Section title={t('showcase.glassDemo')}>
          <div className="relative overflow-hidden rounded-2xl">
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4" aria-hidden>
              {showcaseTasks.concat(showcaseTasks).map((task, i) => (
                <div key={i} className="card p-4">
                  <p className="tabular text-title3 font-extrabold text-accent-text">
                    {formatMoney(task.rewardCents)}
                  </p>
                  <p className="text-callout font-semibold">{task.title}</p>
                </div>
              ))}
            </div>
            <Glass
              radius="2xl"
              className="absolute inset-x-4 bottom-4 flex flex-col gap-3 p-5 md:inset-x-auto md:right-6 md:w-[380px]"
            >
              <p className="text-body font-semibold">{t('showcase.glassDemoText')}</p>
              <Button block onClick={() => setSheetOpen(true)}>
                {t('showcase.openSheet')}
              </Button>
            </Glass>
          </div>
        </Section>

        <Section title={t('showcase.sheet')}>
          <div>
            <Button variant="glass" onClick={() => setSheetOpen(true)}>
              <SlidersHorizontal size={18} strokeWidth={2.6} />
              {t('showcase.openSheet')}
            </Button>
          </div>
        </Section>
      </main>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('showcase.sheetTitle')}
        footer={
          <Button size="lg" block onClick={() => setSheetOpen(false)}>
            {t('common.apply')}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-callout font-bold text-text-2">{t('showcase.sortLabel')}</h3>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <Chip key={s} selected={sort === s} onClick={() => setSort(s)}>
                  {t(`sort.${s}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-callout font-bold text-text-2">{t('showcase.budgetLabel')}</h3>
            <div className="flex flex-wrap gap-2">
              {(['budgetAny', 'budget1', 'budget2', 'budget3'] as const).map((k, i) => (
                <Chip key={k} selected={budget === i} onClick={() => setBudget(i)}>
                  {t(`showcase.${k}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-callout font-bold text-text-2">{t('showcase.categoryLabel')}</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.slice(0, 6).map((c) => (
                <Chip key={c} selected={categories.includes(c)} onClick={() => toggleCategory(c)}>
                  {t(`category.${c}`)}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
