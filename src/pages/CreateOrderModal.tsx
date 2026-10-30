import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, UserRound, X } from 'lucide-react';
import { api } from '../api';
import type { Client, ClientDetail, DictItem } from '../types';
import { formatPhone } from '../format';
import ClientPicker from '../components/ClientPicker';
import { ErrorBox, Field, Modal } from '../components/ui';
import { NumberInput, PhoneInput, Select } from '../components/fields';
import LocationPicker, { type LatLng } from '../components/LocationPicker';

interface L { serviceId: string; price: string }

export default function CreateOrderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [services, setServices] = useState<DictItem[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [addressId, setAddressId] = useState(''); // '' = a new address (pick it on the map)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998');
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [landmark, setLandmark] = useState('');
  const [pickup, setPickup] = useState('');
  const [lines, setLines] = useState<L[]>([{ serviceId: '', price: '' }]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ data: DictItem[] }>('/services').then((r) => setServices(r.data)); }, []);
  const setLine = (i: number, patch: Partial<L>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // Pick a client: load their saved addresses and default to the most recent one.
  const choose = async (c: Client) => {
    setErr('');
    try {
      const d = await api<ClientDetail>(`/clients/${c.id}`);
      setClient(d);
      const last = d.addresses[0];
      if (last) applyAddress(String(last.id), d);
      else { setAddressId(''); setLoc(null); setLandmark(''); }
    } catch (x) { setErr((x as Error).message); }
  };
  const applyAddress = (id: string, from: ClientDetail | null = client) => {
    setAddressId(id);
    const a = from?.addresses.find((x) => String(x.id) === id);
    if (a) { setLoc({ latitude: a.latitude, longitude: a.longitude }); setLandmark(a.landmark); }
    else { setLoc(null); setLandmark(''); }
  };
  const changeMode = (m: 'existing' | 'new') => {
    setMode(m); setClient(null); setAddressId(''); setLoc(null); setLandmark(''); setErr('');
  };
  // clicking the map while a saved address is selected means a new place
  const pickOnMap = (p: LatLng) => { setLoc(p); setAddressId(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'existing' && !client) return setErr('Mijozni tanlang yoki "Yangi mijoz" ni bosing');
    if (!loc) return setErr('Xaritadan lokatsiyani tanlang');
    setBusy(true); setErr('');
    try {
      await api('/orders', {
        method: 'POST',
        body: {
          ...(mode === 'existing' ? { clientId: client!.id } : { clientName: name, clientPhone: phone }),
          location: loc, landmark, pickupTime: pickup,
          lines: lines.map((l) => ({ serviceId: +l.serviceId, price: +l.price })),
        },
      });
      onSaved();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <Modal title="Yangi zakaz" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <ErrorBox msg={err} />
        <div>
          <div role="tablist" aria-label="Mijoz turi" className="mb-3 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
            {([['existing', 'Mavjud mijoz'], ['new', 'Yangi mijoz']] as const).map(([m, label]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => mode !== m && changeMode(m)}
                className={`rounded-[10px] px-4 py-1.5 text-sm font-medium transition ${mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{label}</button>
            ))}
          </div>

          {mode === 'new' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mijoz ismi"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
              <Field label="Telefon"><PhoneInput value={phone} onChange={setPhone} required /></Field>
              <p className="text-xs text-gray-500 sm:col-span-2">Yangi mijoz va uning manzili avtomatik saqlanadi. Telefon raqami allaqachon bor bo'lsa, o'sha mijozga biriktiriladi.</p>
            </div>
          ) : client ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><UserRound size={19} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{client.name}</div>
                  <div className="text-xs text-gray-500">{formatPhone(client.phone)} · {client.ordersCount} ta zakaz{client.debt > 0 ? ' · qarzi bor' : ''}</div>
                </div>
                <button type="button" onClick={() => changeMode('existing')} aria-label="Boshqa mijoz tanlash" title="Boshqa mijoz" className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-200"><X size={16} /></button>
              </div>
              <Field label="Manzil">
                <Select value={addressId} onChange={(v) => applyAddress(v)} placeholder="Yangi manzil (xaritadan tanlang)"
                  options={[
                    ...client.addresses.map((a, i) => ({ value: String(a.id), label: `${a.landmark || 'Manzil'}${i === 0 ? ' · oxirgi' : ''} · ${a.lastUsedAt.slice(0, 10)}` })),
                    { value: '', label: '＋ Yangi manzil' },
                  ]} />
              </Field>
            </div>
          ) : (
            <Field label="Mijozni qidiring"><ClientPicker onPick={choose} /></Field>
          )}
        </div>
        {(mode === 'new' || client) && (
          <Field label={`Lokatsiya ${loc ? `· ${loc.latitude}, ${loc.longitude}` : '(xaritaga bosing)'}`}>
            <LocationPicker value={loc} onChange={pickOnMap} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Orientir"><input className="input" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Masalan: Korzinka yonida" /></Field>
          <Field label="Olib ketilish vaqti"><input className="input" type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} required /></Field>
        </div>

        <div>
          <label className="label">Xizmatlar</label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
                <div className="basis-full sm:flex-1 sm:basis-0">
                  <Select placeholder="Xizmat turi…" required value={l.serviceId} options={services.map((s) => ({ value: String(s.id), label: s.name }))} onChange={(v) => {
                    const svc = services.find((s) => String(s.id) === v);
                    setLine(i, { serviceId: v, ...(svc?.defaultPrice ? { price: String(svc.defaultPrice) } : {}) });
                  }} />
                </div>
                <NumberInput className="flex-1 sm:!w-40 sm:flex-none" min={0} placeholder={`Narx (1 ${services.find((s) => String(s.id) === l.serviceId)?.unit ?? 'kv.m'})`} value={l.price} onChange={(v) => setLine(i, { price: v })} required />
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded-md p-2.5 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLines((ls) => [...ls, { serviceId: '', price: '' }])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            <Plus size={14} /> Xizmat qo'shish
          </button>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Zakaz yaratish'}</button>
      </form>
    </Modal>
  );
}
