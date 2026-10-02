import { radii } from '@parri/ui';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassSurface } from './GlassSurface';
import { usePressSpring } from './usePressSpring';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: 'primary' | 'glass';
  size?: 'lg' | 'md' | 'icon';
  label?: string;
  icon?: React.ReactNode;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT = { lg: 56, md: 48, icon: 48 } as const;

/** Пилюля: главная залита акцентом, второстепенная — стеклянная. */
export function Button({ variant = 'primary', size = 'md', label, icon, block, style, disabled, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const press = usePressSpring();
  const h = HEIGHT[size];
  const inner = (
    <View style={[styles.inner, { height: h, paddingHorizontal: size === 'icon' ? 0 : size === 'lg' ? 28 : 24, width: size === 'icon' ? h : undefined }]}>
      {icon}
      {label ? <AppText variant="button" color={variant === 'primary' ? 'onAccent' : 'text'}>{label}</AppText> : null}
    </View>
  );
  return (
    <Animated.View style={[press.style, block && styles.block, disabled && styles.disabled, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? rest.accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        {...rest}
      >
        {({ pressed }) =>
          variant === 'primary' ? (
            <View
              style={{
                borderRadius: radii.pill,
                backgroundColor: pressed ? colors.accentPressed : colors.accent,
                boxShadow: '0px 8px 24px rgba(255,84,40,0.35)',
              }}
            >
              {inner}
            </View>
          ) : (
            <GlassSurface radius={radii.pill} interactive>
              {inner}
            </GlassSurface>
          )
        }
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  block: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
});
