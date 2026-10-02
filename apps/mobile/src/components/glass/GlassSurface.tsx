import { glass, radii } from '@parri/ui';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { useBlurTarget } from './BlurTarget';

/** Нативный Liquid Glass есть только на iOS 26+ */
export const NATIVE_GLASS =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export interface GlassSurfaceProps {
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Нативное стекло реагирует на касания (iOS 26) */
  interactive?: boolean;
  testID?: string;
}

const SHADOW = `0px ${glass.shadow.y}px ${glass.shadow.blur}px`;

/** Тонкая обводка-блик: градиент от яркого сверху к почти прозрачному снизу */
function EdgeHighlight({ radius, top, bottom }: { radius: number; top: string; bottom: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} onLayout={onLayout}>
      {size && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <SvgGradient id="edge" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={top} />
              <Stop offset="1" stopColor={bottom} />
            </SvgGradient>
          </Defs>
          <Rect
            x={0.5}
            y={0.5}
            width={Math.max(0, size.w - 1)}
            height={Math.max(0, size.h - 1)}
            rx={Math.min(radius, size.h / 2) - 0.5}
            fill="none"
            stroke="url(#edge)"
            strokeWidth={glass.borderWidth}
          />
        </Svg>
      )}
    </View>
  );
}

/**
 * Поверхность из стекла для навигации и контролов.
 * iOS 26 → нативный GlassView; старые iOS, Android и веб → BlurView + заливка + блик;
 * «Уменьшить прозрачность» → сплошной фон.
 */
export function GlassSurface({ radius = radii.xxl, style, children, interactive, testID }: GlassSurfaceProps) {
  const { colors, name, reduceTransparency } = useTheme();
  const blurTarget = useBlurTarget();
  const shadow = { boxShadow: `${SHADOW} ${colors.glassShadow}` } as ViewStyle;

  if (reduceTransparency) {
    return (
      <View
        testID={testID}
        style={[
          { borderRadius: radius, backgroundColor: colors.glassSolid, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder },
          shadow,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  if (NATIVE_GLASS) {
    return (
      <GlassView
        testID={testID}
        glassEffectStyle="regular"
        colorScheme={name}
        isInteractive={interactive}
        style={[{ borderRadius: radius }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    // zIndex: 0 создаёт собственный контекст наложения, а слои стекла (zIndex: -1) уходят под содержимое.
    // На вебе иначе абсолютные слои рисуются поверх текста и backdrop-filter размывает его.
    <View testID={testID} style={[{ borderRadius: radius, zIndex: 0 }, shadow, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', zIndex: -1 }]}>
        <BlurView
          intensity={100}
          tint={name === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          blurMethod={blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFill }]} />
        <LinearGradient
          colors={[colors.glassHighlight, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <EdgeHighlight radius={radius} top={colors.glassBorderTop} bottom={colors.glassBorderBottom} />
      {children}
    </View>
  );
}
