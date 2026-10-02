import { BlurTargetView } from 'expo-blur';
import { createContext, useContext, useRef, type RefObject } from 'react';
import { StyleSheet, type View } from 'react-native';

/**
 * На Android BlurView размывает только содержимое BlurTargetView.
 * Оборачиваем фон и контент экрана, а стеклянные элементы берут ref из контекста.
 */
const BlurTargetContext = createContext<RefObject<View | null> | undefined>(undefined);

export function BlurTargetProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<View | null>(null);
  return (
    <BlurTargetContext.Provider value={ref}>
      <BlurTargetView ref={ref} style={StyleSheet.absoluteFill}>
        {/* Стекло внутри цели не может размывать саму цель — там фолбэк без размытия */}
        <BlurTargetContext.Provider value={undefined}>{children}</BlurTargetContext.Provider>
      </BlurTargetView>
    </BlurTargetContext.Provider>
  );
}

export const useBlurTarget = () => useContext(BlurTargetContext);
