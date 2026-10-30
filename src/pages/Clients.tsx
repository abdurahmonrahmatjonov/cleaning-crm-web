import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, fmtMoney } from '../api';
import { useAuth } from '../auth';
import type { Address, Client, ClientDetail, Page } from '../types';
import { Empty, ErrorBox, Field, Loading, Modal, Pager, StatusBadge, Tabs } from '../components/ui';
import { PhoneInput } from '../components/fields';
import LocationPicker, { type LatLng } from '../components/LocationPicker';
import { formatPhone } from '../format';
import { CommentBadge, default as Comments, useCommentCounts } from '../components/Comments';
import OrderModal from './OrderModal';

export default function Clients() {
  const [rows, setRows] = useState<Client[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const { can } = useAuth();
  const [version, setVersion] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    setLoading(true);
    api<Page<Client>>(`/clients?page=${page}&limit=20&search=${encodeURIComponent(q)}`)
      .then((r) => { setRows(r.data); setMeta(r.meta); })
      .finally(() => setLoading(false));
  }, [page, q, version]);

  const counts = useCommentCounts('client', rows.map((c) => c.id), selected);
  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mijozlar</h1>
          <p className="text-sm text-gray-500">Yangi mijoz zakaz yaratilganda ham avtomatik saqlanadi</p>
        </div>
        {can('clients.manage') && <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Mijoz qo'shish</button>}
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input !pl-10" placeholder="Ism yoki telefon…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="Mijozlar topilmadi" /> : (
          <div className="overflow-x-auto">
            <table className="rtable w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr><th className="th">Ism</th><th className="th">Telefon</th><th className="th !text-right">Zakazlar</th><th className="th !text-right">Qarz</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => setSelected(c.id)} className="cursor-pointer hover:bg-gray-50">
                    <td data-label="Ism" className="td font-medium">{c.name}<CommentBadge n={counts[c.id]} /></td>
                    <td data-label="Telefon" className="td text-gray-600">{formatPhone(c.phone)}</td>
                    <td data-label="Zakazlar" className="td text-right">{c.ordersCount}</td>
                    <td data-label="Qarz" className={`td text-right ${c.debt > 0 ? 'font-medium text-red-600' : 'text-gray-400'}`}>{c.debt > 0 ? fmtMoney(c.debt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={meta.page} limit={meta.limit} total={meta.total} onChange={setPage} />
      </div>
      {creating && <ClientForm onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); setVersion((v) => v + 1); setSelected(id); }} />}
      {selected && <ClientModal id={selected} onClose={() => setSelected(null)} onChanged={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

export function ClientModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged?: () => void }) {
  const { can } = useAuth();
  const [c, setC] = useState<ClientDetail | null>(null);
  const [order, setOrder] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [addr, setAddr] = useState<Address | 'new' | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'info' | 'comments'>('info');
  const [cv, setCv] = useState(0);
  const commentCount = useCommentCounts('client', [id], cv)[id] ?? 0;
  const load = useCallback(() => { api<ClientDetail>(`/clients/${id}`).then(setC); }, [id]);
  useEffect(load, [load]);
  const changed = () => { load(); onChanged?.(); };
  const manage = can('clients.manage');

  const remove = async () => {
    if (!c || !window.confirm(`"${c.name}" mijozini o'chirasizmi? Manzillari ham o'chadi.`)) return;
    try { await api(`/clients/${id}`, { method: 'DELETE' }); onChanged?.(); onClose(); } catch (x) { setErr((x as Error).message); }
  };
  const removeAddress = async (a: Address) => {
    if (!window.confirm("Manzilni o'chirasizmi?")) return;
    try { await api(`/clients/${id}/addresses/${a.id}`, { method: 'DELETE' }); changed(); } catch (x) { setErr((x as Error).message); }
  };

  return (
    <Modal title={c?.name ?? 'Mijoz'} onClose={onClose} wide>
      {!c ? <Loading /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-600">{formatPhone(c.phone)}</span>
            <span>Qarz: <b className={c.debt > 0 ? 'text-red-600' : ''}>{fmtMoney(c.debt)}</b></span>
          </div>
          {manage && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button className="btn-ghost !h-9 !px-3" onClick={() => setEditing(true)}><Pencil size={15} /> Tahrirlash</button>
              <button className="btn-ghost !h-9 !px-3 !text-red-600 disabled:!text-gray-400" onClick={remove} disabled={c.ordersCount > 0}
                title={c.ordersCount > 0 ? "Zakazlari bor mijozni o'chirib bo'lmaydi" : ''}><Trash2 size={15} /> O'chirish</button>
            </div>
          )}
          <ErrorBox msg={err} />
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'info', label: "Ma'lumot" }, { id: 'comments', label: 'Izohlar', badge: commentCount }]} />
          {tab === 'comments' && <Comments bare entity="client" entityId={id} onChange={() => setCv((v) => v + 1)} />}
          {tab === 'info' && <>
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Manzillar ({c.addresses.length})</h3>
              {manage && <button className="text-sm font-semibold text-brand-600 hover:underline" onClick={() => setAddr('new')}>+ Manzil qo'shish</button>}
            </div>
            {c.addresses.length === 0 ? <div className="text-sm text-gray-400">Hali manzil yo'q. Zakaz berilganda avtomatik saqlanadi.</div> : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {c.addresses.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <MapPin size={16} className="shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{a.landmark || 'Orientirsiz manzil'}{i === 0 && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">oxirgi</span>}</div>
                      <a className="text-xs text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}>Xaritada ko'rish</a>
                      <span className="ml-2 text-xs text-gray-400">{a.lastUsedAt.slice(0, 10)}</span>
                    </div>
                    {manage && (
                      <>
                        <button onClick={() => setAddr(a)} aria-label="Manzilni tahrirlash" className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"><Pencil size={15} /></button>
                        <button onClick={() => removeAddress(a)} aria-label="Manzilni o'chirish" className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h3 className="mb-2 text-sm font-semibold">Zakazlar ({c.ordersCount})</h3>
          <table className="rtable w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500">
              <tr><th className="py-2">№</th><th>Status</th><th className="text-right">Jami</th><th className="text-right">To'langan</th><th className="text-right">Sana</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {c.orders.map((o) => (
                <tr key={o.docNum} onClick={() => setOrder(o.docNum)} className="cursor-pointer hover:bg-gray-50">
                  <td data-label="№" className="py-2.5 font-semibold text-brand-600">{o.docNum}</td>
                  <td data-label="Status"><StatusBadge s={o.status} /></td>
                  <td data-label="Jami" className="text-right">{fmtMoney(o.docTotal)}</td>
                  <td data-label="To'langan" className="text-right">{fmtMoney(o.paid)}</td>
                  <td data-label="Sana" className="text-right text-gray-500">{o.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>}
        </>
      )}
      {editing && c && <ClientForm client={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); changed(); }} />}
      {addr && <AddressForm clientId={id} address={addr === 'new' ? null : addr} onClose={() => setAddr(null)} onSaved={() => { setAddr(null); changed(); }} />}
      {order && <OrderModal docNum={order} onClose={() => setOrder(null)} onChanged={changed} />}
    </Modal>
  );
}

/** Add a client, or edit one (name and phone). Orders show the new name/phone too. */
function ClientForm({ client, onClose, onSaved }: { client?: ClientDetail; onClose: () => void; onSaved: (id: number) => void }) {
  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '+998');
  const [withAddress, setWithAddress] = useState(false);
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [landmark, setLandmark] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (withAddress && !loc) return setErr('Manzil uchun xaritadan joyni tanlang yoki manzilni olib tashlang');
    setBusy(true); setErr('');
    try {
      const r = client
        ? await api<{ id: number }>(`/clients/${client.id}`, { method: 'PATCH', body: { name, phone } })
        : await api<{ id: number }>('/clients', { method: 'POST', body: { name, phone, ...(withAddress && loc && { address: { ...loc, landmark } }) } });
      onSaved(r.id);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <Modal title={client ? 'Mijozni tahrirlash' : "Yangi mijoz"} onClose={onClose} wide={!client && withAddress}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox msg={err} />
        <Field label="Ism"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
        <Field label="Telefon"><PhoneInput value={phone} onChange={setPhone} required /></Field>
        {client && <p className="text-xs text-gray-500">Ism va telefon shu mijozning barcha zakazlarida ham yangilanadi.</p>}
        {!client && (withAddress ? (
          <div className="space-y-3 rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Manzil</span>
              <button type="button" className="text-sm font-medium text-red-600 hover:underline" onClick={() => { setWithAddress(false); setLoc(null); setLandmark(''); }}>Olib tashlash</button>
            </div>
            <Field label={`Lokatsiya ${loc ? `· ${loc.latitude}, ${loc.longitude}` : '(xaritaga bosing)'}`}><LocationPicker value={loc} onChange={setLoc} /></Field>
            <Field label="Orientir"><input className="input" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Masalan: Korzinka yonida" /></Field>
          </div>
        ) : (
          <button type="button" className="text-sm font-semibold text-brand-600 hover:underline" onClick={() => setWithAddress(true)}>+ Manzil qo'shish</button>
        ))}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
      </form>
    </Modal>
  );
}

/** Add or edit a saved address: pin on the map plus a landmark. */
function AddressForm({ clientId, address, onClose, onSaved }: { clientId: number; address: Address | null; onClose: () => void; onSaved: () => void }) {
  const [loc, setLoc] = useState<LatLng | null>(address ? { latitude: address.latitude, longitude: address.longitude } : null);
  const [landmark, setLandmark] = useState(address?.landmark ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loc) return setErr('Xaritadan joyni tanlang');
    setBusy(true); setErr('');
    try {
      await api(address ? `/clients/${clientId}/addresses/${address.id}` : `/clients/${clientId}/addresses`, {
        method: address ? 'PATCH' : 'POST', body: { ...loc, landmark },
      });
      onSaved();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <Modal title={address ? 'Manzilni tahrirlash' : "Manzil qo'shish"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox msg={err} />
        <Field label={`Lokatsiya ${loc ? `· ${loc.latitude}, ${loc.longitude}` : '(xaritaga bosing)'}`}><LocationPicker value={loc} onChange={setLoc} /></Field>
        <Field label="Orientir"><input className="input" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Masalan: Korzinka yonida" /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
      </form>
    </Modal>
  );
}
