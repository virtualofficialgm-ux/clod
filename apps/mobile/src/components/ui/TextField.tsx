import { radii } from '@parri/ui';
import { t, type TranslationKey } from '@parri/shared';
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from '@/components/AppText';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export const errorText = (e?: string | null) => (e ? t(e as TranslationKey) : null);

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  counterMax?: number;
}

/** Поле ввода: подпись, счётчик символов, ошибка (ключ локализации) или подсказка */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, hint, counterMax, style, multiline, ...rest }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const err = errorText(error);
  const len = typeof rest.value === 'string' ? rest.value.length : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
          {label}
        </AppText>
        {counterMax ? (
          <AppText variant="caption" color="textSecondary" tabular>
            {t('common.chars', { n: len, max: counterMax })}
          </AppText>
        ) : null}
      </View>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={err ?? hint}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: colors.text,
            // Как в Cal AI: серая заливка без рамки, при фокусе — «чернильная» обводка
            backgroundColor: focused ? colors.cardSolid : colors.fill,
            borderColor: err ? colors.danger : focused ? colors.ink : 'transparent',
            fontFamily: familyByWeight['500'],
            minHeight: multiline ? 112 : 56,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {err ? (
        <AppText variant="callout" accessibilityRole="alert" style={{ color: colors.danger, fontFamily: familyByWeight['600'] }}>
          {err}
        </AppText>
      ) : hint ? (
        <AppText variant="callout" color="textSecondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

export function FormError({ error }: { error?: string | null }) {
  const { colors } = useTheme();
  const text = errorText(error);
  if (!text) return null;
  return (
    <View style={[styles.formError, { backgroundColor: 'rgba(196,43,28,0.12)' }]}>
      <AppText variant="callout" accessibilityRole="alert" style={{ color: colors.danger, fontFamily: familyByWeight['600'] }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  input: { borderWidth: 2, borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 12, fontSize: 17 },
  formError: { borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 12 },
});
