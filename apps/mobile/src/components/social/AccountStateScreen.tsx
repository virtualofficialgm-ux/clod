import { account, t } from '@parri/shared';
import { keys, useApiMutation, useSignOut } from '@parri/shared/react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { FormError } from '@/components/ui/TextField';

/** Деактивированный — «Восстановить аккаунт»; заблокированный модератором — только «Выйти» */
export function AccountStateScreen({ state }: { state: 'deactivated' | 'blocked' }) {
  const signOut = useSignOut();
  const restore = useApiMutation((sb) => account.restore(sb), { invalidate: () => [keys.me] });
  return (
    <View
      style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14 }}
      testID={`account-${state}`}
    >
      <MeshBackground />
      <AppText variant="title2" style={{ textAlign: 'center' }}>
        {state === 'deactivated' ? t('exit.restoreTitle') : t('exit.blockedTitle')}
      </AppText>
      <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        {state === 'deactivated' ? t('exit.restoreText') : t('exit.blockedText')}
      </AppText>
      <FormError error={restore.error?.key} />
      {state === 'deactivated' ? (
        <Button
          size="lg"
          block
          label={t('exit.restore')}
          disabled={restore.isPending}
          onPress={() => restore.mutate(undefined)}
        />
      ) : null}
      <Button
        size="lg"
        variant="glass"
        block
        label={t('common.logout')}
        onPress={async () => {
          await signOut();
          router.replace('/register');
        }}
      />
    </View>
  );
}
