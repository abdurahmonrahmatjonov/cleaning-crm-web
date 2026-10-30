import { useEffect, useState } from 'react';
import { Banknote, HandCoins, ReceiptText, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { api, fmtMoney } from '../api';
import type { Summary as S } from '../types';
import { ErrorBox, Field } from '../components/ui';

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('sv-SE'); };
const today = () => new Date().toLocaleDateString('sv-SE');

export default function Summary() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<S | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!from || !to) return;
    if (from > to) return setErr("Boshlanish sanasi tugash sanasidan keyin bo'lishi mumkin emas");
    setErr('');
    api<S>(`/reports/summary?from=${from}&to=${to}`).then(setData).catch((x) => setErr((x as Error).message));
  }, [from, to]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-xl font-semibold">Hisobot</h1>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Dan"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Gacha"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <ErrorBox msg={err} />
      {data && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card icon={TrendingUp} label="Sotuv" v={fmtMoney(data.sales.total)} sub={`${data.sales.ordersCount} ta zakaz · ${data.sales.totalSqm} kv.m${data.sales.discount > 0 ? ` · chegirma ${fmtMoney(data.sales.discount)}` : ''}`} />
            <Card icon={HandCoins} label="Yig'ilgan" v={fmtMoney(data.collected)} />
            <Card icon={ReceiptText} label="Xarajatlar" v={fmtMoney(data.expenses.total)} />
            <Card icon={Banknote} label="Sof kassa" v={fmtMoney(data.netCash)} danger={data.netCash < 0} />
          </div>
          <Card icon={Wallet} label="Umumiy qarz (barcha vaqt)" v={fmtMoney(data.outstandingDebt)} danger={data.outstandingDebt > 0} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold">Zakazlar statuslari</h2>
              <ul className="divide-y divide-gray-100 text-sm">
                {data.ordersByStatus.map((s) => <li key={s.status} className="flex justify-between py-1.5"><span>{s.status}</span><b>{s.count}</b></li>)}
              </ul>
            </div>
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold">Xarajatlar turlari</h2>
              <ul className="divide-y divide-gray-100 text-sm">
                {data.expenses.byType.length === 0 && <li className="py-1.5 text-gray-400">Xarajatlar yo'q</li>}
                {data.expenses.byType.map((t) => <li key={t.expenseType} className="flex justify-between py-1.5"><span>{t.expenseType}</span><b>{fmtMoney(t.total)}</b></li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Card = ({ icon: Icon, label, v, sub, danger }: { icon: LucideIcon; label: string; v: string; sub?: string; danger?: boolean }) => (
  <div className="card lift p-5">
    <div className="flex items-center gap-2 text-sm text-gray-500"><span className={`grid h-8 w-8 place-items-center rounded-lg ${danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}><Icon size={16} /></span>{label}</div>
    <div className={`mt-1.5 font-display text-2xl font-bold ${danger ? 'text-red-600' : ''}`}>{v}</div>
    {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
  </div>
);
