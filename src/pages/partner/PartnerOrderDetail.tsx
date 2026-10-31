import { useEffect, useState } from 'react';
import { api } from '../../api';
import { ErrorBox, Loading, Modal, StatusBadge } from '../../components/ui';
import type { PartnerOrder } from '../../types';
import { money, num } from './util';

const OPEN = 'Zakaz Qabul qilindi';

export default function PartnerOrderDetail({ docNum, onClose, onChanged }: { docNum: number; onClose: () => void; onChanged: () => void }) {
  const [o, setO] = useState<PartnerOrder | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState<Record<number, string>>({});
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const load = (alive: () => boolean = () => true) =>
    api<PartnerOrder>(`/partner/orders/${docNum}`)
      .then((r) => { if (!alive()) return; setO(r); setExp(Object.fromEntries(r.lines.map((l) => [l.id, String(l.expectedQuantity || '')]))); })
      .catch((e) => { if (alive()) setErr((e as Error).message); });
  useEffect(() => { let a = true; load(() => a); return () => { a = false; }; }, [docNum]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!o) return;
    const lines = o.lines.map((l) => ({ id: l.id, expectedQuantity: Math.max(0, Math.floor(Number(exp[l.id] || 0))) }));
    if (lines.some((l) => !Number.isFinite(l.expectedQuantity) || l.expectedQuantity > 100000)) { setErr("Soni noto'g'ri"); return; }
    setBusy(true); setErr('');
    try { setO(await api<PartnerOrder>(`/partner/orders/${docNum}`, { method: 'PATCH', body: { lines } })); onChanged(); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!reason.trim()) { setErr('Bekor qilish sababini yozing'); return; }
    setBusy(true); setErr('');
    try { await api(`/partner/orders/${docNum}/cancel`, { method: 'POST', body: { reason: reason.trim() } }); onChanged(); onClose(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  const open = o?.status === OPEN;
  const handed = o?.status === 'Yetkazib berildi';
  return (
    <Modal title={`Buyurtma №${docNum}`} onClose={onClose} wide>
      {!o && !err && <Loading />}
      <div className="space-y-4">
        <ErrorBox msg={err} />
        {o && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <StatusBadge s={o.status} partner />
              <span>Sana: {o.createdAt}</span>
              {o.deliveredDate && <span>Topshirilgan: {o.deliveredDate}</span>}
            </div>
            <div className="space-y-3">
              {o.lines.map((l) => (
                <div key={l.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{l.serviceName} <span className="text-gray-400">({l.unit})</span></div>
                    {open && (
                      <input className="input !h-10 !w-24 text-right" type="number" min={0} max={100000} step={1} inputMode="numeric"
                        aria-label="Taxminiy soni" placeholder="Soni" value={exp[l.id] ?? ''} disabled={busy}
                        onChange={(e) => setExp({ ...exp, [l.id]: e.target.value })} />
                    )}
                  </div>
                  <div className="mt-1 text-gray-500">
                    {!open && <>Taxminiy soni: {l.expectedQuantity || '—'}. </>}
                    {l.quantity != null && <>Soni: <b>{l.quantity}</b></>}
                  </div>
                  {l.sizes.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-gray-700">
                      {l.sizes.map((s, i) => <li key={i} className="tabular-nums">{num(s.width)} × {num(s.length)} = {num(s.area)} kv.m</li>)}
                      <li className="font-medium">Jami: {num(l.sizesTotal)} kv.m</li>
                    </ul>
                  )}
                  {handed && l.lineTotal != null && (
                    <div className="mt-2 flex flex-wrap gap-x-4 border-t border-gray-100 pt-2 text-gray-700">
                      <span>Narx: {money(l.price)}</span>
                      {l.unit === 'kv.m' && <span>{num(l.sqm ?? 0)} kv.m</span>}
                      <span className="font-semibold">{money(l.lineTotal)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {handed && o.docTotal != null && (
              <div className="space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
                <div className="flex justify-between"><span>Jami</span><b>{money(o.docTotal)}</b></div>
                <div className="flex justify-between"><span>To'langan</span><span>{money(o.paid)}</span></div>
                {!!o.discount && <div className="flex justify-between"><span>Chegirma</span><span>{money(o.discount)}</span></div>}
                <div className="flex justify-between"><span>Qarz</span><b className={(o.debt ?? 0) > 0 ? 'text-red-600' : ''}>{money(o.debt)}</b></div>
              </div>
            )}
            {open && !cancelling && (
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
                <button className="btn-ghost flex-1 !text-red-600" disabled={busy} onClick={() => { setCancelling(true); setErr(''); }}>Bekor qilish</button>
              </div>
            )}
            {open && cancelling && (
              <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <label className="label" htmlFor="cancel-reason">Bekor qilish sababi</label>
                <textarea id="cancel-reason" className="input" rows={2} maxLength={500} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 !bg-red-600" disabled={busy || !reason.trim()} onClick={cancel}>{busy ? 'Yuborilmoqda…' : 'Ha, bekor qilish'}</button>
                  <button className="btn-ghost flex-1" disabled={busy} onClick={() => setCancelling(false)}>Orqaga</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
