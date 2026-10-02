import { radii } from '@parri/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassSurface } from './GlassSurface';
import { usePressSpring } from './usePressSpring';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

/** Плашка фильтра: стеклянная, выбранная — сплошная контрастная. */
export function Chip({ label, selected, onPress, icon }: ChipProps) {
  const { colors } = useTheme();
  const press = usePressSpring();
  const content = (
    <View style={styles.row}>
      {icon}
      <AppText variant="callout" style={{ fontFamily: 'Manrope_600SemiBold' }} color={selected ? 'background' : 'text'}>
        {label}
      </AppText>
    </View>
  );
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
      >
        {selected ? (
          <View style={{ borderRadius: radii.pill, backgroundColor: colors.text }}>{content}</View>
        ) : (
          <GlassSurface radius={radii.pill}>{content}</GlassSurface>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { height: 40, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
