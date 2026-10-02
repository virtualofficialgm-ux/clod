import { t, type PeopleQuery, type TranslationKey } from '@parri/shared';
import { usePeople, useSkills } from '@parri/shared/react';
import { useDeferredValue, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { SlidersHorizontal, Users } from '@/components/icons';
import { InviteSheet } from '@/components/social/InviteSheet';
import { PersonCard } from '@/components/social/PersonCard';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Center, EmptyState, Label, PageTitle, Row } from '@/components/ui/bits';
import { Card, Toggle } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

const EMPTY: PeopleQuery = {
  role: 'all',
  skill: null,
  city: null,
  minRating: null,
  available: false,
  sort: 'relevance',
};

export default function People() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const [f, setF] = useState<PeopleQuery>(EMPTY);
  const [filters, setFilters] = useState(false);
  const [offer, setOffer] = useState<{ id: string; name: string } | null>(null);
  const skills = useSkills().data ?? [];
  const list = usePeople({ ...f, query: q });
  const items = list.data?.pages.flat() ?? [];
  return (
    <Screen
      title={t('people.title')}
      leading={<BackButton />}
      onRefresh={() => list.refetch()}
      overlay={<InviteSheet user={offer} onClose={() => setOffer(null)} />}
    >
      <PageTitle>{t('people.title')}</PageTitle>
      <Segmented
        value={f.role ?? 'all'}
        onChange={(role) => setF((s) => ({ ...s, role }))}
        options={(['all', 'executors', 'customers'] as const).map((v) => ({
          value: v,
          label: t(`people.role.${v}`),
        }))}
      />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField label={t('people.search')} value={query} onChangeText={setQuery} />
        </View>
        <Button
          variant={filters ? 'primary' : 'glass'}
          size="icon"
          accessibilityLabel={t('people.filters')}
          icon={<SlidersHorizontal size={18} color={filters ? colors.onAccent : colors.text} />}
          onPress={() => setFilters((v) => !v)}
        />
      </View>
      {filters ? (
        <Card>
          <Label>{t('people.skill')}</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <Chip
              label={t('people.anySkill')}
              selected={!f.skill}
              onPress={() => setF((s) => ({ ...s, skill: null }))}
            />
            {skills.slice(0, 40).map((s) => (
              <Chip
                key={s.slug}
                label={t(`skill.${s.slug}` as TranslationKey)}
                selected={f.skill === s.slug}
                onPress={() => setF((x) => ({ ...x, skill: s.slug }))}
              />
            ))}
          </ScrollView>
          <TextField
            label={t('people.city')}
            value={f.city ?? ''}
            onChangeText={(v) => setF((s) => ({ ...s, city: v || null }))}
          />
          <Label>{t('people.rating')}</Label>
          <Row>
            {([null, 4, 4.5] as const).map((r) => (
              <Chip
                key={String(r)}
                label={
                  r == null
                    ? t('people.ratingAny')
                    : r === 4
                      ? t('people.rating40')
                      : t('people.rating45')
                }
                selected={(f.minRating ?? null) === r}
                onPress={() => setF((s) => ({ ...s, minRating: r }))}
              />
            ))}
          </Row>
          <Toggle
            value={!!f.available}
            onChange={(available) => setF((s) => ({ ...s, available }))}
            label={t('people.available')}
          />
          <Segmented
            value={f.sort ?? 'relevance'}
            onChange={(sort) => setF((s) => ({ ...s, sort }))}
            options={(['relevance', 'rating', 'experience'] as const).map((v) => ({
              value: v,
              label: t(`people.sort.${v}`),
            }))}
          />
          <Button
            variant="glass"
            label={t('people.reset')}
            onPress={() => setF({ ...EMPTY, role: f.role })}
          />
        </Card>
      ) : null}
      {list.isLoading ? (
        <Center />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users size={36} color={colors.textSecondary} />}
          title={t('people.empty')}
          text={t('people.emptyText')}
        />
      ) : (
        <View style={{ gap: 12 }} testID="people-list">
          {items.map((p) => (
            <PersonCard
              key={p.id}
              p={p}
              onOffer={
                p.platform_role !== 'customer'
                  ? () => setOffer({ id: p.id, name: p.name })
                  : undefined
              }
            />
          ))}
          {list.hasNextPage ? (
            <Button
              variant="glass"
              label={t('people.loadMore')}
              disabled={list.isFetchingNextPage}
              onPress={() => list.fetchNextPage()}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
