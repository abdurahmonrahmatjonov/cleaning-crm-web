import { useEffect, useState } from 'react';
import { api, todayStr } from '../../api';
import { Empty, ErrorBox, Loading, StatusBadge } from '../../components/ui';
import type { Statement } from '../../types';
import { num } from './util';
import { fmtMoneyExact as money } from '../../format';

const Card = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="card px-4 py-3"><div className="text-xs text-gray-500">{label}</div><div className={`mt-0.5 text-base font-bold tabular-nums ${tone ?? ''}`}>{value}</div></div>
);

export default function PartnerStatement() {
  const cur = todayStr().slice(0, 7);
  const [month, setMonth] = useState(cur);
  const [st, setSt] = useState<Statement | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    let alive = true;
    setErr(''); setSt(null);
    api<Statement>(`/partner/statement?month=${month}`)
      .then((r) => { if (alive) setSt(r); })
      .catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, [month]);

  return (
    <div className="space-y-3">
      <div className="card flex items-center gap-3 px-4 py-3">
        <label className="label !mb-0" htmlFor="st-month">Oy</label>
        <input id="st-month" className="input !w-44" type="month" value={month} max={cur} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </div>
      <ErrorBox msg={err} />
      {!st && !err && <div className="card"><Loading /></div>}
      {st && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card label="Oy boshidagi qarz" value={money(st.opening)} />
            <Card label="Hisoblangan" value={money(st.charges)} />
            <Card label="To'lovlar (chegirma bilan)" value={money(st.credits)} />
            <Card label="Oy oxiridagi qarz" value={money(st.closing)} tone={st.closing > 0 ? 'text-red-600' : ''} />
          </div>
          <Block title="Topshirilgan buyurtmalar">
            {st.orders.length === 0 ? <Empty text="Buyurtmalar yo'q" /> : st.orders.map((o) => (
              <Row key={o.docNum} a={`№${o.docNum}`} b={`${o.deliveredDate} · ${num(o.sqmTotal)} kv.m`} c={money(o.docTotal)} />
            ))}
          </Block>
          <Block title="To'lovlar">
            {st.payments.length === 0 ? <Empty text="To'lovlar yo'q" /> : st.payments.map((p) => (
              <Row key={p.batchId} a={p.paidDate} b={p.discount ? `Chegirma: ${money(p.discount)}` : ''} c={money(p.amount)} />
            ))}
          </Block>
          {st.inProgress.length > 0 && (
            <Block title="Jarayonda">
              {st.inProgress.map((o) => (
                <div key={o.docNum} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span><b>№{o.docNum}</b> <span className="text-xs text-gray-500">{o.createdAt}</span></span>
                  <StatusBadge s={o.status} partner />
                </div>
              ))}
            </Block>
          )}
        </>
      )}
    </div>
  );
}

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card overflow-hidden">
    <h3 className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">{title}</h3>
    <div className="divide-y divide-gray-100">{children}</div>
  </section>
);
const Row = ({ a, b, c }: { a: string; b: string; c: string }) => (
  <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
    <div><div className="font-medium">{a}</div>{b && <div className="text-xs text-gray-500">{b}</div>}</div>
    <div className="font-semibold tabular-nums">{c}</div>
  </div>
);
