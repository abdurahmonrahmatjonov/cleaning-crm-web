import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Empty, ErrorBox, Loading } from '../../components/ui';
import type { PartnerMe, PartnerOrder, PartnerService } from '../../types';
import { money } from './util';

export default function PartnerNewOrder({ me, onCreated }: { me: PartnerMe | null; onCreated: () => void }) {
  const nav = useNavigate();
  const [services, setServices] = useState<PartnerService[] | null>(null);
  const [sel, setSel] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<PartnerService[]>('/partner/services')
      .then((r) => { if (alive) setServices(r); })
      .catch((e) => { if (alive) { setErr((e as Error).message); setServices([]); } });
    return () => { alive = false; };
  }, []);

  const ids = Object.keys(sel).map(Number);
  const full = !!me && me.receivedOrders >= me.orderCap;
  const toggle = (id: number) => setSel((s) => {
    const n = { ...s };
    if (id in n) delete n[id]; else n[id] = '';
    return n;
  });

  const submit = async () => {
    const lines = ids.map((serviceId) => {
      const q = Math.floor(Number(sel[serviceId]));
      return sel[serviceId] !== '' && q > 0 ? { serviceId, expectedQuantity: q } : { serviceId };
    });
    if (lines.some((l) => 'expectedQuantity' in l && (l.expectedQuantity as number) > 100000)) { setErr("Soni noto'g'ri"); return; }
    setBusy(true); setErr('');
    try {
      const o = await api<PartnerOrder>('/partner/orders', { method: 'POST', body: { lines } });
      onCreated();
      nav('/', { state: { created: o.docNum } });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  if (services === null) return <div className="card"><Loading /></div>;
  return (
    <div className="space-y-3">
      <ErrorBox msg={err} />
      {full && <ErrorBox msg={`Ochiq buyurtmalar limiti: ${me!.orderCap}. Yangi buyurtma berish uchun avvalgilari qabul qilinishini kuting.`} />}
      {services.length === 0 ? (
        <div className="card"><Empty text="Narxlar belgilanmagan, administratorga murojaat qiling" /></div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {services.map((s) => {
            const on = s.id in sel;
            return (
              <div key={s.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(s.id)} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-xs text-gray-500">{money(s.price)} / {s.unit}</span>
                  </span>
                </label>
                {on && (
                  <input className="input !h-10 !w-24 text-right" type="number" min={1} max={100000} step={1} inputMode="numeric"
                    aria-label={`${s.name}: taxminiy soni`} placeholder="Soni" value={sel[s.id]} disabled={busy}
                    onChange={(e) => setSel({ ...sel, [s.id]: e.target.value })} />
                )}
              </div>
            );
          })}
        </div>
      )}
      {services.length > 0 && (
        <button className="btn-primary w-full !h-12" disabled={busy || ids.length === 0 || full || ids.length > 20} onClick={submit}>
          {busy ? 'Yuborilmoqda…' : `Buyurtma berish${ids.length ? ` (${ids.length})` : ''}`}
        </button>
      )}
      <p className="text-center text-xs text-gray-400">Narxlar yakuniy: kv.m narxi har bir kv.m uchun. Summa topshirilgandan keyin hisoblanadi.</p>
    </div>
  );
}
