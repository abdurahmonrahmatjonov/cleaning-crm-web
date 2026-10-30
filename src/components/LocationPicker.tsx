import { lazy, Suspense } from 'react';

export type LatLng = { latitude: number; longitude: number };
export interface PickerProps { value: LatLng | null; onChange: (p: LatLng) => void }

// Yandex Maps needs an API key (VITE_YANDEX_KEY); without it we fall back to Leaflet + CARTO tiles.
const Impl = import.meta.env.VITE_YANDEX_KEY
  ? lazy(() => import('./YandexPicker'))
  : lazy(() => import('./LeafletPicker'));

export default function LocationPicker(props: PickerProps) {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-gray-100" />}>
      <Impl {...props} />
    </Suspense>
  );
}
