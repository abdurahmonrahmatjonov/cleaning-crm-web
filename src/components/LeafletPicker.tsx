import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { useTheme } from '../theme';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

const pin = L.icon({ iconUrl: icon, iconRetinaUrl: icon2x, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41] });
import type { LatLng } from './LocationPicker';
const TASHKENT: [number, number] = [41.3111, 69.2797];

function Clicker({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ latitude: +e.latlng.lat.toFixed(6), longitude: +e.latlng.lng.toFixed(6) }) });
  return null;
}

function Fly({ to, value }: { to: [number, number] | null; value: LatLng | null }) {
  const map = useMap();
  // a searched place always recenters
  useEffect(() => { if (to) map.setView(to, 16); }, [map, to]);
  // a pin that was set from outside (e.g. a saved address) recenters only if it's off screen
  useEffect(() => {
    if (value && !map.getBounds().contains([value.latitude, value.longitude])) map.setView([value.latitude, value.longitude], Math.max(map.getZoom(), 15));
  }, [map, value?.latitude, value?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function LeafletPicker({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  const dark = useTheme() === 'dark';
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [to, setTo] = useState<[number, number] | null>(null);

  async function search() {
    if (!q.trim()) return;
    setBusy(true); setErr('');
    try {
      // Nominatim (OpenStreetMap) geocoder: free, no API key
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=uz&q=${encodeURIComponent(q)}`);
      const [hit] = await r.json();
      if (!hit) { setErr('Topilmadi'); return; }
      const lat = +(+hit.lat).toFixed(6), lon = +(+hit.lon).toFixed(6);
      setTo([lat, lon]);
      onChange({ latitude: lat, longitude: lon });
    } catch { setErr('Qidiruvda xatolik'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Joy nomini kiriting: Chilonzor, Toshkent..."
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm" />
        <button type="button" onClick={search} disabled={busy} className="rounded-lg bg-blue-600 px-4 text-sm text-snow disabled:opacity-50">{busy ? '...' : 'Qidirish'}</button>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <MapContainer center={value ? [value.latitude, value.longitude] : TASHKENT} zoom={12} className="h-72 w-full rounded-lg ring-1 ring-gray-200">
        <TileLayer key={dark ? 'd' : 'l'} className={dark ? 'invert hue-rotate-180 brightness-95 contrast-90' : ''} attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker onPick={onChange} />
        <Fly to={to} value={value} />
        {value && <Marker position={[value.latitude, value.longitude]} icon={pin} />}
      </MapContainer>
    </div>
  );
}
