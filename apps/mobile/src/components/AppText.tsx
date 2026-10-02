import { typeScaleMobile, type ThemeColors } from '@parri/ui';
import { Text, type TextProps } from 'react-native';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export type TextVariant = keyof typeof typeScaleMobile;
type ColorKey = 'text' | 'textSecondary' | 'textTertiary' | 'accentText' | 'onAccent' | 'background';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: ColorKey;
  tabular?: boolean;
}

/** Текст по типографической шкале Parri: крупно, жирно, с отрицательным трекингом */
export function AppText({ variant = 'body', color = 'text', tabular, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const s = typeScaleMobile[variant];
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[
        {
          fontFamily: familyByWeight[s.weight],
          fontSize: s.size,
          lineHeight: s.lineHeight,
          letterSpacing: s.tracking * s.size,
          color: colors[color as keyof ThemeColors] as string,
        },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    />
  );
}
