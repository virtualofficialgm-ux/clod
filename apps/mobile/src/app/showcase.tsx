import {
  CATEGORIES,
  SORTS,
  TASK_KINDS,
  formatMoney,
  priceBreakdown,
  showcaseTasks,
  t,
  type Category,
  type FeedSort,
  type TaskKind,
} from '@parri/shared';
import { Bell, ChevronLeft, Search, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BlurTargetProvider } from '@/components/glass/BlurTarget';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { GlassSurface, NATIVE_GLASS } from '@/components/glass/GlassSurface';
import { Header } from '@/components/glass/Header';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { Segmented } from '@/components/glass/Segmented';
import { TabBar, type TabKey } from '@/components/glass/TabBar';
import { TaskCard } from '@/components/task/TaskCard';
import { useTheme, type ThemePref } from '@/theme/ThemeProvider';

function Section({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  return (
    <Animated.View entering={FadeInDown.springify().delay(index * 40)} style={styles.section}>
      <AppText variant="title2" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </Animated.View>
  );
}

export default function ShowcaseScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const [kind, setKind] = useState<TaskKind>('online');
  const [categories, setCategories] = useState<Category[]>(['design']);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<FeedSort>('recommended');
  const [tab, setTab] = useState<TabKey>('feed');

  const toggle = (c: Category) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const sample = priceBreakdown(2500);
  const icon = (I: typeof Bell) => <I size={20} strokeWidth={2.4} color={colors.text} />;

  return (
    <View style={styles.flex}>
      <BlurTargetProvider>
        <MeshBackground />
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 120 }]}
        >
          <View style={styles.hero}>
            <AppText variant="display" accessibilityRole="header">
              {t('showcase.title')}
              <AppText variant="display" style={{ color: colors.accent }}>.</AppText>
            </AppText>
            <AppText variant="title3" color="textSecondary">
              {t('showcase.subtitle')}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {NATIVE_GLASS ? 'iOS 26 · GlassView' : 'expo-blur fallback'}
            </AppText>
          </View>

          <Section index={0} title={t('showcase.controls')}>
            <Segmented<ThemePref>
              value={theme.themePref}
              onChange={theme.setThemePref}
              options={[
                { value: 'system', label: t('common.themeSystem') },
                { value: 'light', label: t('common.themeLight') },
                { value: 'dark', label: t('common.themeDark') },
              ]}
            />
            <View style={styles.wrap}>
              <Chip
                label={t('showcase.reduceTransparency')}
                selected={theme.forceReduceTransparency}
                onPress={() => theme.setForceReduceTransparency(!theme.forceReduceTransparency)}
              />
              <Chip
                label={t('showcase.reduceMotion')}
                selected={theme.forceReduceMotion}
                onPress={() => theme.setForceReduceMotion(!theme.forceReduceMotion)}
              />
            </View>
            <AppText variant="callout" color="textSecondary">
              {t('showcase.a11yNote')}
            </AppText>
          </Section>

          <Section index={1} title={t('showcase.typography')}>
            <View style={[styles.card, { backgroundColor: theme.reduceTransparency ? colors.cardSolid : colors.card, borderColor: colors.cardBorder }]}>
              <AppText variant="display">{t('app.tagline')}</AppText>
              <AppText variant="title1">{t('nav.feed')}</AppText>
              <AppText variant="title2">{t('kind.campus')}</AppText>
              <AppText variant="title3">{t('showcase.sampleTitle1')}</AppText>
              <AppText variant="price" color="accentText" tabular>
                {formatMoney(sample.total)}
              </AppText>
              <AppText variant="body">{t('fees.rule')}</AppText>
              <AppText variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }}>
                {t('safe.name')}
              </AppText>
            </View>
          </Section>

          <Section index={2} title={t('showcase.buttons')}>
            <Button size="lg" label={t('showcase.primary')} block />
            <View style={styles.wrap}>
              <Button label={t('showcase.primary')} />
              <Button variant="glass" label={t('showcase.secondary')} />
              <Button label={t('showcase.disabled')} disabled />
            </View>
            <View style={styles.wrap}>
              <Button variant="glass" size="icon" accessibilityLabel={t('common.search')} icon={icon(Search)} />
              <Button
                variant="glass"
                size="icon"
                accessibilityLabel={t('common.filters')}
                icon={icon(SlidersHorizontal)}
                onPress={() => setSheetOpen(true)}
              />
              <Button variant="glass" size="icon" accessibilityLabel={t('showcase.notifications')} icon={icon(Bell)} />
            </View>
          </Section>

          <Section index={3} title={t('showcase.segmented')}>
            <Segmented<TaskKind>
              value={kind}
              onChange={setKind}
              options={TASK_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
            />
          </Section>

          <Section index={4} title={t('showcase.chips')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chipsRow}>
              <Chip
                label={t('common.filters')}
                icon={<SlidersHorizontal size={16} strokeWidth={2.6} color={colors.text} />}
                onPress={() => setSheetOpen(true)}
              />
              {CATEGORIES.map((c) => (
                <Chip key={c} label={t(`category.${c}`)} selected={categories.includes(c)} onPress={() => toggle(c)} />
              ))}
            </ScrollView>
          </Section>

          <Section index={5} title={t('showcase.cards')}>
            {showcaseTasks.map((task) => (
              <TaskCard key={task.id} task={task} onPress={() => {}} />
            ))}
          </Section>

          <Section index={6} title={t('showcase.glass')}>
            <GlassSurface style={styles.glassDemo}>
              <AppText variant="bodyStrong">{t('showcase.glassDemoText')}</AppText>
              <Button label={t('showcase.openSheet')} block onPress={() => setSheetOpen(true)} />
            </GlassSurface>
          </Section>
        </Animated.ScrollView>
      </BlurTargetProvider>

      <Header
        title={t('showcase.title')}
        scrollY={scrollY}
        leading={<Button variant="glass" size="icon" accessibilityLabel={t('showcase.back')} icon={icon(ChevronLeft)} />}
        actions={<Button variant="glass" size="icon" accessibilityLabel={t('showcase.notifications')} icon={icon(Bell)} />}
      />
      <TabBar active={tab} onChange={(k) => (k === 'create' ? setSheetOpen(true) : setTab(k))} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('showcase.sheetTitle')}
        footer={<Button size="lg" block label={t('common.apply')} onPress={() => setSheetOpen(false)} />}
      >
        <View style={styles.group}>
          <AppText variant="callout" color="textSecondary" style={{ fontFamily: 'Manrope_700Bold' }}>
            {t('showcase.sortLabel')}
          </AppText>
          <View style={styles.wrap}>
            {SORTS.map((s) => (
              <Chip key={s} label={t(`sort.${s}`)} selected={sort === s} onPress={() => setSort(s)} />
            ))}
          </View>
        </View>
        <View style={styles.group}>
          <AppText variant="callout" color="textSecondary" style={{ fontFamily: 'Manrope_700Bold' }}>
            {t('showcase.categoryLabel')}
          </AppText>
          <View style={styles.wrap}>
            {CATEGORIES.slice(0, 6).map((c) => (
              <Chip key={c} label={t(`category.${c}`)} selected={categories.includes(c)} onPress={() => toggle(c)} />
            ))}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 40 },
  hero: { gap: 8 },
  section: { gap: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 12 },
  bleed: { marginHorizontal: -16, marginVertical: -16 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  glassDemo: { padding: 20, gap: 16 },
  group: { gap: 12 },
});
