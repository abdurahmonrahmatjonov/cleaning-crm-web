import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, fmtMoney, todayStr } from '../api';
import { useAuth } from '../auth';
import type { PaymentBatch, Statement } from '../types';
import { Empty, ErrorBox, Field, Loading } from '../components/ui';
import { NumberInput } from '../components/fields';

const card = 'rounded-xl border border-gray-200 p-3';
const month = () => todayStr().slice(0, 7);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Money with tiyin shown only when the amount has a fractional part. */
const fmtMoney2 = (n: number) => {
  const x = round2(n);
  return Number.isInteger(x) ? fmtMoney(x) : new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) + " so'm";
};
/** Plain numeric string for an input: at most 2 decimals, no trailing zeros. */
const plain2 = (n: number) => round2(n).toFixed(2).replace(/\.?0+$/, '');

/** Lump payment form, payment history and monthly statement of a saygak. */
export function PartnerMoney({ clientId, onChanged }: { clientId: number; onChanged: () => void }) {
  const [v, setV] = useState(0); // bump to refetch debt, history and statement
  const changed = () => { setV((x) => x + 1); onChanged(); };
  return (
    <>
      <PayCard clientId={clientId} v={v} onPaid={changed} />
      <History clientId={clientId} v={v} onChanged={changed} />
      <StatementCard clientId={clientId} v={v} />
    </>
  );
}

function PayCard({ clientId, v, onPaid }: { clientId: number; v: number; onPaid: () => void }) {
  const { can } = useAuth();
  const [debt, setDebt] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ docNum: number; cash: number; disc: number }[] | null>(null);

  // Closing balance of the current month approximates the saygak's debt. It is only a hint: the server decides.
  useEffect(() => {
    let live = true;
    api<Statement>(`/clients/${clientId}/statement?month=${month()}`).then((s) => live && setDebt(s.closing)).catch((x) => live && setErr((x as Error).message));
    return () => { live = false; };
  }, [clientId, v]);

  const allowed = can('orders.payments');
  const over = debt !== null && round2(Number(amount || 0) + Number(discount || 0)) > round2(debt);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const a = round2(Number(amount || 0)), d = round2(Number(discount || 0));
    if (a + d <= 0) return setErr("Summani kiriting");
    setBusy(true); setErr(''); setDone(null);
    try {
      const r = await api<{ allocations: { docNum: number; cash: number; disc: number }[]; debtLeft: number }>(`/clients/${clientId}/payments`, {
        method: 'POST', body: { ...(a > 0 && { amount: a }), ...(d > 0 && { discount: d }), paidDate: date },
      });
      setDone(r.allocations); setAmount(''); setDiscount(''); onPaid();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className={card}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Oylik to'lov qabul qilish</h3>
        <span className="text-sm">Saygak qarzi: <b className={debt ? 'text-red-600' : ''}>{debt === null ? '…' : fmtMoney2(debt)}</b></span>
      </div>
      <ErrorBox msg={err} />
      {!allowed && <div className="text-sm text-gray-500">To'lov qabul qilish uchun ruxsat yo'q</div>}
      <fieldset disabled={!allowed || busy} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Summa">
            <div className="flex gap-2">
              <NumberInput decimal value={amount} onChange={setAmount} min={0} />
              <button type="button" className="btn-ghost !h-9 shrink-0 !px-3" disabled={!debt || debt <= 0} onClick={() => debt && setAmount(plain2(debt))}>To'liq qarz</button>
            </div>
          </Field>
          {can('orders.discount') && <Field label="Chegirma"><NumberInput decimal value={discount} onChange={setDiscount} min={0} /></Field>}
          <Field label="Sana"><input className="input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} required /></Field>
        </div>
        {over && <div className="text-sm text-amber-600">Summa qarzdan oshib ketdi, server tekshiradi</div>}
        <button className="btn-primary !h-9 !px-4">{busy ? 'Saqlanmoqda…' : "To'lovni qabul qilish"}</button>
      </fieldset>
      {done && (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <div className="font-semibold">To'lov taqsimlandi</div>
          <ul>{done.map((a) => <li key={a.docNum}>№{a.docNum}: {fmtMoney(a.cash)}{a.disc > 0 && ` + chegirma ${fmtMoney(a.disc)}`}</li>)}</ul>
        </div>
      )}
    </form>
  );
}

function History({ clientId, v, onChanged }: { clientId: number; v: number; onChanged: () => void }) {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<PaymentBatch[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<{ data: PaymentBatch[] }>(`/clients/${clientId}/payments`).then((r) => live && setRows(r.data)).catch((x) => live && (setErr((x as Error).message), setRows([])));
    return () => { live = false; };
  }, [clientId, v]);

  const reverse = async (id: string) => {
    setBusy(true); setErr('');
    try { await api(`/clients/${clientId}/payments/${id}`, { method: 'DELETE' }); setConfirm(null); onChanged(); } catch (x) {
      setErr((x as Error).message);
      if ((x as { status?: number }).status === 409) { setConfirm(null); onChanged(); } // already reversed elsewhere: refresh
    }
    setBusy(false);
  };

  return (
    <div className={card}>
      <h3 className="mb-2 text-sm font-semibold">To'lovlar tarixi</h3>
      <ErrorBox msg={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <div className="text-sm text-gray-400">To'lovlar yo'q</div> : (
        <ul className="divide-y divide-gray-100">
          {rows.map((b) => {
            const off = !!b.reversedAt;
            return (
              <li key={b.batchId} className={`py-2 text-sm ${off ? 'text-gray-400' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={off ? 'line-through' : 'font-medium'}>{fmtMoney(b.amount)}{b.discount > 0 && ` + chegirma ${fmtMoney(b.discount)}`}</span>
                  <span className="text-xs">{b.paidDate} · {b.creatorName}</span>
                </div>
                {off && <div className="text-xs">bekor qilingan{b.reversedByName && ` (${b.reversedByName})`}</div>}
                {isAdmin && !off && (confirm === b.batchId ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-red-600">Shu to'lov bekor qilinsinmi?</span>
                    <button className="btn-ghost !h-9 !px-3 font-semibold !text-red-600" disabled={busy} onClick={() => reverse(b.batchId)}>Ha, bekor qilish</button>
                    <button className="btn-ghost !h-9 !px-3" disabled={busy} onClick={() => setConfirm(null)}>Yo'q</button>
                  </div>
                ) : (
                  <button className="btn-ghost mt-1 !h-9 !px-3 font-semibold !text-red-600" onClick={() => setConfirm(b.batchId)}>Bekor qilish</button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatementCard({ clientId, v }: { clientId: number; v: number }) {
  const [m, setM] = useState(month());
  const [s, setS] = useState<Statement | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    let live = true;
    setS(null); setErr('');
    api<Statement>(`/clients/${clientId}/statement?month=${m}`).then((r) => live && setS(r)).catch((x) => live && setErr((x as Error).message));
    return () => { live = false; };
  }, [clientId, m]);
  useEffect(load, [load, v]);

  const stats: [string, number][] = s ? [['Boshlang\'ich qoldiq', s.opening], ['Hisoblangan', s.charges], ["To'langan + chegirma", s.credits], ['Yakuniy qoldiq', s.closing]] : [];
  return (
    <div className={card}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Hisobot</h3>
        <input className="input !h-9 !w-40" type="month" aria-label="Oy" value={m} max={month()} onChange={(e) => e.target.value && setM(e.target.value)} />
      </div>
      <ErrorBox msg={err} />
      {!s ? (err ? null : <Loading />) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map(([k, n]) => <div key={k} className="rounded-lg bg-gray-50 p-2"><div className="text-xs text-gray-500">{k}</div><div className="text-sm font-semibold">{fmtMoney(n)}</div></div>)}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Topshirilgan zakazlar</div>
            {s.orders.length === 0 ? <Empty text="Bu oyda zakaz yo'q" /> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {s.orders.map((o) => (
                  <li key={o.docNum} className="flex items-center justify-between gap-2 py-1.5">
                    <span><b className="text-brand-600">№{o.docNum}</b> <span className="text-xs text-gray-500">{o.deliveredDate} · {o.sqmTotal} kv.m</span></span>
                    <span>{fmtMoney(o.docTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {s.payments.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">To'lovlar</div>
              <ul className="divide-y divide-gray-100 text-sm">
                {s.payments.map((p) => (
                  <li key={p.batchId} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-xs text-gray-500">{p.paidDate}</span>
                    <span>{fmtMoney(p.amount)}{p.discount > 0 && ` + chegirma ${fmtMoney(p.discount)}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.inProgress.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Jarayonda</div>
              <ul className="text-sm">{s.inProgress.map((o) => <li key={o.docNum} className="flex justify-between py-1"><b>№{o.docNum}</b><span className="text-gray-500">{o.status}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
