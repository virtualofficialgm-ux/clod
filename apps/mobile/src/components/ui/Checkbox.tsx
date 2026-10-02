import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Check } from '@/components/icons';
import { useTheme } from '@/theme/ThemeProvider';

/** Галочка с подписью (соглашения, «Я ознакомился») */
export function Checkbox({ checked, onChange, label, children, testID }: { checked: boolean; onChange: (v: boolean) => void; label: string; children?: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={styles.row}
      hitSlop={6}
    >
      <View style={[styles.box, { borderColor: checked ? colors.accent : colors.textTertiary, backgroundColor: checked ? colors.accent : 'transparent' }]}>
        {checked ? <Check size={16} strokeWidth={3.2} color={colors.onAccent} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children ?? <AppText variant="callout">{label}</AppText>}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
