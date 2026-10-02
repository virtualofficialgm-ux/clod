import { createContext, useContext, useEffect, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Портал: шторки и модальные окна рисуются поверх всего приложения, включая таб-бар
 * (иначе таб-бар навигатора оказывается выше шторки и перехватывает нажатия).
 */
type Api = { set: (key: string, node: React.ReactNode | null) => void };
const PortalContext = createContext<Api | null>(null);

export function PortalHost({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<Record<string, React.ReactNode>>({});
  const [api] = useState<Api>(() => ({
    set: (key, node) =>
      setNodes((prev) => {
        if (node === null) {
          const { [key]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [key]: node };
      }),
  }));
  return (
    <PortalContext.Provider value={api}>
      {children}
      {Object.keys(nodes).length > 0 ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}>
          {Object.entries(nodes).map(([k, n]) => (
            <View key={k} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              {n}
            </View>
          ))}
        </View>
      ) : null}
    </PortalContext.Provider>
  );
}

export function Portal({ children }: { children: React.ReactNode }) {
  const api = useContext(PortalContext);
  const key = useId();
  useEffect(() => {
    api?.set(key, children);
  });
  useEffect(() => () => api?.set(key, null), [api, key]);
  // Без хоста (витрина, тесты) — рисуем на месте
  return api ? null : <>{children}</>;
}
