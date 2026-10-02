'use client';

import 'leaflet/dist/leaflet.css';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

/**
 * Карта OpenStreetMap (Leaflet): точка «я», точки задач, линия маршрута до выбранной.
 * Без координат пользователя не рисуем ничего — фиктивных точек нет.
 */
export function NearbyMap({
  me,
  points,
  selected,
  onSelect,
  zoomSignal,
  centerSignal,
}: {
  me: { lat: number; lng: number } | null;
  points: MapPoint[];
  selected: string | null;
  onSelect: (id: string) => void;
  zoomSignal: { n: number; d: 1 | -1 };
  centerSignal: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<import('leaflet').LayerGroup | null>(null);
  const L = useRef<typeof import('leaflet') | null>(null);

  useEffect(() => {
    let alive = true;
    void import('leaflet').then((mod) => {
      if (!alive || !el.current || map.current) return;
      L.current = mod;
      map.current = mod.map(el.current, { zoomControl: false, attributionControl: true }).setView(me ? [me.lat, me.lng] : [55.75, 37.62], me ? 15 : 3);
      mod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map.current);
      layer.current = mod.layerGroup().addTo(map.current);
    });
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Перерисовка точек и маршрута
  useEffect(() => {
    const mod = L.current;
    const m = map.current;
    const g = layer.current;
    if (!mod || !m || !g) return;
    g.clearLayers();
    if (!me) return;
    mod.circleMarker([me.lat, me.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#1E6BFF', fillOpacity: 1 }).addTo(g);
    for (const p of points) {
      const on = p.id === selected;
      mod
        .circleMarker([p.lat, p.lng], { radius: on ? 12 : 9, color: '#fff', weight: 3, fillColor: '#FF5428', fillOpacity: 1 })
        .bindTooltip(p.label)
        .on('click', () => onSelect(p.id))
        .addTo(g);
    }
    const sel = points.find((p) => p.id === selected);
    if (sel) {
      const line: LatLngExpression[] = [
        [me.lat, me.lng],
        [sel.lat, sel.lng],
      ];
      mod.polyline(line, { color: '#FF5428', weight: 4, dashArray: '8 8' }).addTo(g);
      m.fitBounds(mod.latLngBounds(line), { padding: [60, 60], maxZoom: 17 });
    }
  }, [me, points, selected, onSelect]);

  useEffect(() => {
    if (zoomSignal.n) map.current?.setZoom((map.current.getZoom() ?? 14) + zoomSignal.d);
  }, [zoomSignal]);
  useEffect(() => {
    if (centerSignal && me) map.current?.setView([me.lat, me.lng], 15);
  }, [centerSignal, me]);

  return <div ref={el} className="h-full w-full" data-testid="nearby-map" role="application" aria-label="Карта задач рядом" />;
}
