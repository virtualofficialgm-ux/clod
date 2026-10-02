import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import type { TextStyleToken } from '@parri/ui';

export const fontAssets = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

/** В React Native у кастомного шрифта отдельное семейство на каждую жирность */
export const familyByWeight: Record<TextStyleToken['weight'], keyof typeof fontAssets> = {
  '400': 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  '700': 'Manrope_700Bold',
  '800': 'Manrope_800ExtraBold',
};
