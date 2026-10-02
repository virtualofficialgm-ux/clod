import { files as filesApi, t, type Attachment, type FileRef } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { FileText } from '@/components/icons';
import { Linking, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card, useToast } from '@/components/ui/bits';
import { useTheme } from '@/theme/ThemeProvider';

/** Файлы задачи: открываются по временной подписанной ссылке (бакет приватный) */
export function FileList({ items }: { items: (Attachment | FileRef)[] }) {
  const sb = useSupabase();
  const toast = useToast();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((f) => (
        <Pressable
          key={f.path}
          accessibilityRole="link"
          accessibilityLabel={f.name}
          onPress={async () => {
            try {
              await Linking.openURL(await filesApi.signedUrl(sb, f.path));
            } catch {
              toast(t('errors.download_failed'), 'error');
            }
          }}
        >
          <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <FileText size={20} color={colors.accentText} />
            <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
              {f.name}
            </AppText>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
