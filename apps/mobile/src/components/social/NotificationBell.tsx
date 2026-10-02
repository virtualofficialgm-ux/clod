import { t } from '@parri/shared';
import { useSession, useUnreadNotifications } from '@parri/shared/react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Bell } from '@/components/icons';
import { useTheme } from '@/theme/ThemeProvider';

/** Колокольчик с числом новых уведомлений */
export function NotificationBell() {
  const { colors } = useTheme();
  const { session } = useSession();
  const n = useUnreadNotifications(!!session);
  return (
    <Pressable
      testID="bell"
      accessibilityRole="button"
      accessibilityLabel={n ? `${t('notif.title')}: ${n}` : t('notif.title')}
      onPress={() => router.push('/notifications')}
      hitSlop={6}
    >
      <GlassSurface
        radius={999}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Bell size={20} color={colors.text} />
      </GlassSurface>
      {n > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 4,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" color="onAccent" style={{ fontSize: 11, lineHeight: 14 }}>
            {n > 99 ? '99+' : String(n)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
