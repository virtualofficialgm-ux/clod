'use client';

import { useCallback, useEffect, useState } from 'react';

export type GeoState = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

/**
 * Реальная геолокация браузера. Никаких подставных координат:
 * если доступа нет — coords остаётся null, а экран честно об этом говорит.
 */
export function useGeolocation(auto = false) {
  const [state, setState] = useState<GeoState>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unavailable');
      return;
    }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setState('granted');
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (!auto || typeof navigator === 'undefined') return;
    // Если разрешение уже выдано — берём координаты сразу, без лишнего клика
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (p.state === 'granted') request();
        else if (p.state === 'denied') setState('denied');
      })
      .catch(() => {});
  }, [auto, request]);

  return { state, coords, request };
}
