import { radii } from '@parri/ui';
import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/** Код из 6 цифр: одно скрытое поле (автозаполнение из SMS/почты) и шесть ячеек */
export function OtpField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { colors } = useTheme();
  const ref = useRef<TextInput>(null);
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
        {label}
      </AppText>
      <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessibilityLabel={label}>
        {Array.from({ length: 6 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              { backgroundColor: colors.fill, borderColor: i === value.length ? colors.ink : 'transparent' },
            ]}
          >
            <AppText variant="title3" tabular>
              {value[i] ?? ''}
            </AppText>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        accessibilityLabel={label}
        style={styles.hidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, height: 60, borderRadius: radii.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
