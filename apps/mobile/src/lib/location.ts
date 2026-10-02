import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type GeoState = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

/** Реальная геолокация устройства. Без разрешения coords = null — никаких выдуманных точек. */
export function useDeviceLocation(auto = false) {
  const [state, setState] = useState<GeoState>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const locate = useCallback(async () => {
    setState('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setState('denied');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setAccuracy(pos.coords.accuracy == null ? null : Math.round(pos.coords.accuracy));
      setState('granted');
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch {
      setState('unavailable');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (p.status === 'granted') void locate();
        else if (p.status === 'denied' && !p.canAskAgain) setState('denied');
      })
      .catch(() => {});
  }, [auto, locate]);

  return { state, coords, accuracy, locate };
}
