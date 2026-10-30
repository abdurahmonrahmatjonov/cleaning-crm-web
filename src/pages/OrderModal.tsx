import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, fmtMoney, todayStr } from '../api';
import { useAuth } from '../auth';
import type { Order, Payment } from '../types';
import { ErrorBox, Field, Loading, Modal, StatusBadge, Tabs } from '../components/ui';
import { NumberInput, PhoneInput } from '../components/fields';
import { formatNumber, formatPhone } from '../format';
import OrderHistory from '../components/History';
import Comments, { useCommentCounts } from '../components/Comments';
import LocationPicker, { type LatLng } from '../components/LocationPicker';

const toInput = (s: string) => s.slice(0, 16).replace(' ', 'T');

export default function OrderModal({ docNum, onClose, onChanged }: {
  docNum: number; onClose: () => void; onChanged: () => void;
}) {
  const { can } = useAuth();
  const [version, setVersion] = useState(0);
  const [order, setOrder] = useState<Order | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'cancel'>('view');
  const [tab, setTab] = useState<'info' | 'comments' | 'history'>('info');
  const [err, setErr] = useState('');
  const commentCount = useCommentCounts('order', [docNum], version)[docNum] ?? 0;

  const load = useCallback(() => {
    api<Order>(`/orders/${docNum}`).then(setOrder).catch((x) => setErr((x as Error).message));
  }, [docNum]);
  useEffect(load, [load]);

  const saved = (o?: Order) => { if (o) setOrder(o); else load(); setMode('view'); setVersion((v) => v + 1); onChanged(); };

  if (!order) {
    return <Modal title={`Zakaz #${docNum}`} onClose={onClose} wide>{err ? <ErrorBox msg={err} /> : <Loading />}</Modal>;
  }

  const canManage = can('orders.edit');
  const canPay = can('orders.payments');
  const inWork = ['Olib Ketildi', "Yuvib bo'lingan", 'Upakovka qilingan'];
  const open = order.status === 'Zakaz Qabul qilindi' || inWork.includes(order.status);

  return (
    <Modal title={`Zakaz #${order.docNum}`} onClose={onClose} wide>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-md bg-gray-50 p-4 text-sm">
        <div>
          <div className="font-semibold">{order.clientName}</div>
          <div className="text-gray-500">{formatPhone(order.clientPhone)}</div>
          <div className="mt-1 text-gray-500">{order.landmark}</div>
          <a className="text-xs font-semibold text-brand-600 hover:underline" target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps?q=${order.location.latitude},${order.location.longitude}`}>Xaritada ko'rish</a>
        </div>
        <div className="w-full text-left text-xs text-gray-500 sm:w-auto sm:text-right">
          <StatusBadge s={order.status} />
          <div className="mt-2">Olib ketish: {order.pickupTime.slice(0, 16)}</div>
          <div>Kiritdi: {order.createdBy.name}</div>
          {order.waybillNumber && <div>Nakladnoy: {order.waybillNumber}</div>}
          {order.deliveryTime && <div>Yetkazish: {order.deliveryTime.slice(0, 16)}</div>}
          {order.pickedUpBy && <div>Olib ketdi: {order.pickedUpBy}</div>}
          {order.washedBy && <div>Yuvdi: {order.washedBy}</div>}
          {order.packedBy && <div>Upakovka qildi: {order.packedBy}</div>}
          {order.deliveredBy && <div>Yetkazdi: {order.deliveredBy}</div>}
        </div>
      </div>

      {mode === 'edit' ? (
        <EditForm order={order} onCancel={() => setMode('view')} onSaved={saved} />
      ) : mode === 'cancel' ? (
        <CancelForm order={order} onBack={() => setMode('view')} onSaved={saved} />
      ) : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[
            { id: 'info', label: "Ma'lumot" },
            { id: 'comments', label: 'Izohlar', badge: commentCount },
            { id: 'history', label: 'Tarix' },
          ]} />
          {tab === 'comments' && <Comments bare entity="order" entityId={order.docNum} onChange={() => setVersion((v) => v + 1)} />}
          {tab === 'history' && <OrderHistory bare docNum={order.docNum} refreshKey={version} />}
          {tab === 'info' && <>
          {order.status === 'Zakaz Qabul qilindi' && (can('orders.pickup') ? <PickupForm order={order} onSaved={saved} /> : <LinesTable order={order} />)}
          {order.status === 'Olib Ketildi' && (
            <Step order={order} allowed={can('orders.wash')} path="wash" label="Yuvib bo'lindi" hint="Bu son alohida saqlanadi. Mijoz to'lovi upakovka sonidan hisoblanadi." onSaved={saved} />
          )}
          {order.status === "Yuvib bo'lingan" && (
            <Step order={order} allowed={can('orders.pack')} path="pack" label="Upakovka qilindi" hint="Shundan so'ng haydovchi yetkazib beradi." onSaved={saved} />
          )}
          {order.status === 'Upakovka qilingan' && (can('orders.deliver') ? <DeliverForm order={order} canDiscount={can('orders.discount')} onSaved={saved} /> : <LinesTable order={order} />)}
          {order.status === 'Yetkazib berildi' && (
            <>
              <LinesTable order={order} />
              <div className={`mt-4 grid grid-cols-1 gap-3 text-center text-sm ${order.discount > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                <Stat label="Jami" v={fmtMoney(order.docTotal)} />
                {order.discount > 0 && <Stat label="Chegirma" v={`− ${fmtMoney(order.discount)}`} />}
                <Stat label="To'langan" v={fmtMoney(order.paid)} />
                <Stat label="Qarz" v={fmtMoney(order.debt)} danger={order.debt > 0} />
              </div>
              <Payments order={order} canPay={canPay} canDiscount={can('orders.discount')} onSaved={saved} />
            </>
          )}
          {order.status === 'Bekor qilindi' && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="font-semibold">Bekor qilingan {order.cancelledAt.slice(0, 16)}</div>
              <div className="mt-1">{order.cancelReason}</div>
            </div>
          )}
          {open && canManage && (
            <div className="mt-5 flex gap-2 border-t border-gray-100 pt-4">
              {order.status === 'Zakaz Qabul qilindi' && <button className="btn-ghost" onClick={() => setMode('edit')}>Tahrirlash</button>}
              <button className="btn-ghost !text-red-600" onClick={() => setMode('cancel')}>Bekor qilish</button>
            </div>
          )}
          </>}
        </>
      )}
    </Modal>
  );
}

/**
 * Washing / packing step: count the pieces again, then confirm.
 * Washing keeps its count separately; the packed count becomes the quantity the client is charged for.
 */
function Step({ order, allowed, path, label, hint, onSaved }: {
  order: Order; allowed: boolean; path: 'wash' | 'pack'; label: string; hint: string; onSaved: (o: Order) => void;
}) {
  const start = (l: Order['lines'][number]) => String(path === 'pack' ? l.washedQuantity || l.quantity : l.quantity);
  const [qty, setQty] = useState<Record<number, string>>(() => Object.fromEntries(order.lines.map((l) => [l.id, start(l)])));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      onSaved(await api<Order>(`/orders/${order.docNum}/${path}`, {
        method: 'PATCH',
        body: { lines: order.lines.map((l) => ({ id: l.id, quantity: +qty[l.id] })) },
      }));
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  if (!allowed) return <div className="space-y-4"><LinesTable order={order} /><p className="text-sm text-gray-500">Bu bosqichni bajarish uchun ruxsatingiz yo'q.</p></div>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox msg={err} />
      <div className="space-y-2">
        <label className="label">{path === 'wash' ? 'Yuvilgandan keyingi soni (dona)' : "Upakovka qilingan soni (dona). Mijoz shu son bo'yicha to'laydi"}</label>
        {order.lines.map((l) => {
          const differs = path === 'pack' && +qty[l.id] !== l.pickedQuantity;
          return (
            <div key={l.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-medium">
                {l.serviceName}
                <span className="block text-xs font-normal text-gray-400">
                  olingan {l.pickedQuantity || l.quantity}{path === 'pack' && l.washedQuantity ? ` · yuvilgan ${l.washedQuantity}` : ''}
                  {differs && <span className="ml-1 text-amber-600">· olinganidan farq qiladi</span>}
                </span>
              </span>
              <NumberInput className="!w-28" min={1} value={qty[l.id] ?? ''} onChange={(v) => setQty({ ...qty, [l.id]: v })} required />
            </div>
          );
        })}
      </div>
      <p className="text-sm text-gray-500">{hint}</p>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : label}</button>
    </form>
  );
}

function PickupForm({ order, onSaved }: { order: Order; onSaved: (o: Order) => void }) {
  const [waybill, setWaybill] = useState(order.waybillNumber);
  const [delivery, setDelivery] = useState('');
  const [qty, setQty] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const o = await api<Order>(`/orders/${order.docNum}/pickup`, {
        method: 'PATCH',
        body: { waybillNumber: waybill, deliveryTime: delivery, lines: order.lines.map((l) => ({ id: l.id, quantity: +qty[l.id] })) },
      });
      onSaved(o);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox msg={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nakladnoy raqami"><input className="input" value={waybill} onChange={(e) => setWaybill(e.target.value)} required /></Field>
        <Field label="Yetkazilish vaqti"><input className="input" type="datetime-local" value={delivery} onChange={(e) => setDelivery(e.target.value)} required /></Field>
      </div>
      <div className="space-y-2">
        <label className="label">Soni (dona)</label>
        {order.lines.map((l) => (
          <div key={l.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium">{l.serviceName}</span>
            <NumberInput className="!w-32" min={1} value={qty[l.id] ?? ''} onChange={(v) => setQty({ ...qty, [l.id]: v })} required />
          </div>
        ))}
      </div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Olib ketildi'}</button>
    </form>
  );
}

function DeliverForm({ order, canDiscount, onSaved }: { order: Order; canDiscount: boolean; onSaved: (o: Order) => void }) {
  const [discount, setDiscount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [paid, setPaid] = useState('');
  const [sqm, setSqm] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const amountOf = (l: Order['lines'][number]) => (l.unit === 'dona' ? l.quantity : +sqm[l.id] || 0);
  const total = order.lines.reduce((s, l) => s + amountOf(l) * l.price, 0);
  const debt = Math.max(total - (+discount || 0) - (+paid || 0), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const o = await api<Order>(`/orders/${order.docNum}/deliver`, {
        method: 'PATCH',
        body: { deliveredDate: date, paid: +paid || 0, ...(+discount > 0 && { discount: +discount }), lines: order.lines.map((l) => (l.unit === 'dona' ? { id: l.id } : { id: l.id, sqm: +sqm[l.id] })) },
      });
      onSaved(o);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox msg={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Yetkazib berilgan sana"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Mijozdan olingan summa"><NumberInput min={0} value={paid} onChange={setPaid} placeholder="0" /></Field>
        {canDiscount && <Field label="Chegirma (so'm)"><NumberInput min={0} max={Math.round(total)} value={discount} onChange={setDiscount} placeholder="0" /></Field>}
      </div>
      <div className="space-y-2">
        <label className="label">O'lchamlar (narx × miqdor)</label>
        {order.lines.map((l) => (
          <div key={l.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium">{l.serviceName} <span className="text-gray-400">· {l.quantity} dona · {fmtMoney(l.price)}/{l.unit}</span></span>
            {l.unit === 'dona'
              ? <span className="w-32 text-right text-sm text-gray-500">{l.quantity} dona</span>
              : <NumberInput decimal className="!w-32" min={0.01} value={sqm[l.id] ?? ''} onChange={(v) => setSqm({ ...sqm, [l.id]: v })} placeholder={l.unit} required />}
          </div>
        ))}
      </div>
      <div className="space-y-1 rounded-md bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
        <div className="flex justify-between"><span>Jami</span><span>{fmtMoney(total)}</span></div>
        {+discount > 0 && <div className="flex justify-between"><span>Chegirma</span><span>− {fmtMoney(+discount)}</span></div>}
        <div className="flex justify-between"><span>Qarz</span><span>{fmtMoney(debt)}</span></div>
      </div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Yetkazib berildi'}</button>
    </form>
  );
}

function EditForm({ order, onCancel, onSaved }: { order: Order; onCancel: () => void; onSaved: (o: Order) => void }) {
  const [name, setName] = useState(order.clientName);
  const [phone, setPhone] = useState(order.clientPhone);
  const [landmark, setLandmark] = useState(order.landmark);
  const [pickup, setPickup] = useState(toInput(order.pickupTime));
  const [loc, setLoc] = useState<LatLng | null>(order.location);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const o = await api<Order>(`/orders/${order.docNum}`, {
        method: 'PATCH',
        body: { clientName: name, clientPhone: phone, landmark, pickupTime: pickup, ...(loc && { location: loc }) },
      });
      onSaved(o);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox msg={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mijoz ismi"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Telefon"><PhoneInput value={phone} onChange={setPhone} required /></Field>
        <Field label="Orientir"><input className="input" value={landmark} onChange={(e) => setLandmark(e.target.value)} /></Field>
        <Field label="Olib ketilish vaqti"><input className="input" type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} required /></Field>
      </div>
      <Field label="Lokatsiya"><LocationPicker value={loc} onChange={setLoc} /></Field>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Ortga</button>
        <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
      </div>
    </form>
  );
}

function CancelForm({ order, onBack, onSaved }: { order: Order; onBack: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api(`/orders/${order.docNum}/cancel`, { method: 'POST', body: { reason } });
      onSaved();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox msg={err} />
      <Field label="Bekor qilish sababi"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required /></Field>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={onBack}>Ortga</button>
        <button className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Zakazni bekor qilish'}</button>
      </div>
    </form>
  );
}

function Payments({ order, canPay, canDiscount, onSaved }: { order: Order; canPay: boolean; canDiscount: boolean; onSaved: (o: Order) => void }) {
  const [list, setList] = useState<Payment[]>([]);
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: Payment[] } | Payment[]>(`/orders/${order.docNum}/payments`)
      .then((r) => setList(Array.isArray(r) ? r : r.data))
      .catch(() => setList([]));
  }, [order.docNum, order.paid]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const o = await api<Order>(`/orders/${order.docNum}/payments`, { method: 'POST', body: { amount: +amount || 0, discount: +discount || 0, paidDate: date } });
      setAmount(''); setDiscount('');
      onSaved(o);
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };

  return (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <h3 className="mb-2 text-sm font-semibold">To'lovlar tarixi</h3>
      {list.length === 0 ? <div className="text-sm text-gray-400">To'lovlar yo'q</div> : (
        <ul className="divide-y divide-gray-100 text-sm">
          {list.map((p, i) => (
            <li key={i} className="flex justify-between py-1.5"><span className="text-gray-500">{String(p.paidDate ?? '').slice(0, 10)}{p.discount ? <span className="ml-2 text-xs text-gray-400">chegirma {fmtMoney(p.discount)}</span> : null}</span><b>{fmtMoney(p.amount)}</b></li>
          ))}
        </ul>
      )}
      {canPay && order.debt > 0 && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <ErrorBox msg={err} />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Summa"><NumberInput min={0} max={order.debt - (+discount || 0)} value={amount} onChange={setAmount} placeholder={`Maks. ${formatNumber(String(order.debt))}`} required={!(+discount > 0)} /></Field>
            {canDiscount && <Field label="Chegirma (so'm)"><NumberInput min={0} max={order.debt} value={discount} onChange={setDiscount} placeholder="0" /></Field>}
            <Field label="Sana"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
            <button className="btn-primary" disabled={busy}>{busy ? 'Saqlanmoqda…' : +discount > 0 && !(+amount > 0) ? 'Chegirma berish' : "To'lov qabul qilish"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

const Stat = ({ label, v, danger }: { label: string; v: string; danger?: boolean }) => (
  <div className="rounded-md bg-gray-50 p-3"><div className="text-xs text-gray-500">{label}</div><div className={`font-bold ${danger ? 'text-red-600' : ''}`}>{v}</div></div>
);

function LinesTable({ order }: { order: Order }) {
  return (
    <div className="sm:overflow-x-auto"><table className="rtable w-full text-sm">
      <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2">Xizmat</th><th>Soni</th><th>O'lcham</th><th className="text-right">Narx</th><th className="text-right">Jami</th></tr></thead>
      <tbody className="divide-y divide-gray-100">
        {order.lines.map((l) => (
          <tr key={l.id}><td data-label="Xizmat" className="py-2.5 font-medium">{l.serviceName}</td><td data-label="Soni">{l.quantity || '—'}{(l.pickedQuantity && l.pickedQuantity !== l.quantity) || (l.washedQuantity && l.washedQuantity !== l.quantity) ? <span className="block text-[11px] text-gray-400">olingan {l.pickedQuantity || '—'} · yuvilgan {l.washedQuantity || '—'}</span> : null}</td><td data-label="O'lcham">{l.unit === 'dona' ? '—' : l.sqm ? `${l.sqm} ${l.unit}` : '—'}</td><td data-label="Narx" className="text-right">{fmtMoney(l.price)}/{l.unit}</td><td data-label="Jami" className="text-right font-semibold">{fmtMoney(l.lineTotal)}</td></tr>
        ))}
      </tbody>
    </table></div>
  );
}
