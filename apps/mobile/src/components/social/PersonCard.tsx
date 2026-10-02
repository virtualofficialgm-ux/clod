import { t, type PersonCard as Person, type TranslationKey } from '@parri/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { BadgeCheck } from '@/components/icons';
import { Avatar, Pill, Row } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

export function PersonCard({ p, onOffer }: { p: Person; onOffer?: () => void }) {
  const { colors } = useTheme();
  const open = () => router.push(`/u/${p.username ?? p.id}`);
  return (
    <Card testID="person">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={p.name}
        onPress={open}
        style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
      >
        <Avatar name={p.name} url={p.avatar_url} size={52} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {p.name}
            </AppText>
            {p.verified ? <BadgeCheck size={16} color={colors.accent} /> : null}
          </View>
          {p.headline ? (
            <AppText variant="callout" color="textSecondary" numberOfLines={1}>
              {p.headline}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textSecondary">
            {p.rating_avg ? `★ ${Number(p.rating_avg).toFixed(1)}` : t('people.new')} ·{' '}
            {t('people.done', { n: p.completed_count })}
            {p.city ? ` · ${p.city}` : ''} · {t(`people.availability.${p.availability}`)}
          </AppText>
        </View>
      </Pressable>
      {p.skills.length > 0 && (
        <Row>
          {p.skills.slice(0, 4).map((s) => (
            <Pill key={s}>{t(`skill.${s}` as TranslationKey)}</Pill>
          ))}
        </Row>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button variant="glass" block label={t('people.open')} onPress={open} />
        </View>
        {onOffer ? (
          <View style={{ flex: 1 }}>
            <Button block label={t('people.offer')} onPress={onOffer} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
