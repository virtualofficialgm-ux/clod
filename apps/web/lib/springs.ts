import { motion as m } from '@parri/ui';
import type { Transition } from 'framer-motion';

export const springs = {
  press: { type: 'spring', ...m.spring.press },
  sheet: { type: 'spring', ...m.spring.sheet },
  appear: { type: 'spring', ...m.spring.appear },
} satisfies Record<string, Transition>;

export const PRESS_SCALE = m.pressScale;
