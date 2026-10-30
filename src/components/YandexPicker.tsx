import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme';
import type { PickerProps } from './LocationPicker';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TASHKENT: [number, number] = [69.2797, 41.3111]; // Yandex v3 uses [lon, lat]
let loading: Promise<any> | null = null;

function loadYmaps(key: string): Promise<any> {
  const w = window as any;
  loading ??= new Promise((resolve, reject) => {
    if (w.ymaps3) return w.ymaps3.ready.then(() => resolve(w.ymaps3));
    const s = document.createElement('script');
    s.src = `https://api-maps.yandex.ru/v3/?apikey=${key}&lang=en_US`;
    s.onload = () => w.ymaps3.ready.then(() => resolve(w.ymaps3));
    s.onerror = () => { loading = null; reject(new Error("Yandex xaritasi yuklanmadi")); };
    document.head.appendChild(s);
  });
  return loading;
}

const pinEl = () => {
  const el = document.createElement('div');
  el.style.cssText = 'transform:translate(-50%,-100%);pointer-events:none';
  el.innerHTML = '<svg width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7 0 15.7 0 27 16 42 16 42s16-15 16-26.3C32 7 24.800 0 16 0z" fill="#2563eb"/><circle cx="16" cy="15.500" r="6" fill="#fff"/></svg>';
  return el;
};

export default function YandexPicker({ value, onChange }: PickerProps) {
  const dark = useTheme() === 'dark';
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<{ map: any; layer: any; marker: any; y: any } | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const latest = useRef({ value, dark });
  latest.current = { value, dark };
  const [err, setErr] = useState('');

  useEffect(() => {
    let dead = false;
    loadYmaps(import.meta.env.VITE_YANDEX_KEY as string).then((y) => {
      if (dead || !box.current) return;
      const { value: v, dark: d } = latest.current;
      const center: [number, number] = v ? [v.longitude, v.latitude] : TASHKENT;
      const map = new y.YMap(box.current, { location: { center, zoom: v ? 15 : 11 } });
      const layer = new y.YMapDefaultSchemeLayer({ theme: d ? 'dark' : 'light' });
      map.addChild(layer);
      map.addChild(new y.YMapDefaultFeaturesLayer({}));
      map.addChild(new y.YMapListener({
        layer: 'any',
        onClick: (_o: unknown, e: { coordinates: [number, number] }) =>
          cb.current({ latitude: +e.coordinates[1].toFixed(6), longitude: +e.coordinates[0].toFixed(6) }),
      }));
      const marker = new y.YMapMarker({ coordinates: center }, pinEl());
      if (v) map.addChild(marker);
      api.current = { map, layer, marker, y };
    }).catch((x) => setErr((x as Error).message));
    return () => { dead = true; api.current?.map.destroy(); api.current = null; };
  }, []);

  useEffect(() => { api.current?.layer.update({ theme: dark ? 'dark' : 'light' }); }, [dark]);

  useEffect(() => {
    const a = api.current;
    if (!a || !value) return;
    a.marker.update({ coordinates: [value.longitude, value.latitude] });
    if (!a.map.children.includes(a.marker)) a.map.addChild(a.marker);
  }, [value]);

  if (err) return <div className="grid h-72 place-items-center rounded-lg bg-gray-100 text-sm text-red-600">{err}</div>;
  return <div ref={box} className="h-72 w-full overflow-hidden rounded-lg ring-1 ring-gray-200" />;
}
