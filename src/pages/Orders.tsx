import { useCallback, useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { MapPin, Plus, Search } from 'lucide-react';
import { api, fmtMoney } from '../api';
import { useAuth } from '../auth';
import type { Order, Page } from '../types';
import { Empty, Loading, Pager, SaygakBadge, StatusBadge } from '../components/ui';
import { formatPhone } from '../format';
import { CommentBadge, useCommentCounts } from '../components/Comments';
import CreateOrderModal from './CreateOrderModal';
import OrderModal from './OrderModal';

const TABS = {
  received: { title: 'Olingan zakazlar', hint: 'Yangi qabul qilingan zakazlar' },
  'picked-up': { title: 'Olib ketilganlar', hint: 'Mijozdan olib ketilgan, yuvilishi kutilmoqda' },
  washed: { title: "Yuvib bo'lingan", hint: 'Yuvilgan, upakovka qilinishi kutilmoqda' },
  packed: { title: 'Upakovka qilingan', hint: 'Tayyor, haydovchi yetkazib berishi mumkin' },
  completed: { title: 'Tugallangan sotuvlar', hint: 'Yetkazib berilgan zakazlar' },
  cancelled: { title: 'Bekor qilinganlar', hint: 'Bekor qilingan zakazlar' },
} as const;
type Tab = keyof typeof TABS;


export default function Orders() {
  const { tab } = useParams();
  if (!tab || !(tab in TABS)) return <Navigate to="/sales/received" replace />;
  return <OrderList key={tab} tab={tab as Tab} />;
}

function OrderList({ tab }: { tab: Tab }) {
  const { can } = useAuth();
  const [rows, setRows] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    api<Page<Order>>(`/orders/${tab}?page=${page}&limit=20&search=${encodeURIComponent(q)}`)
      .then((r) => { setRows(r.data); setMeta(r.meta); })
      .finally(() => setLoading(false));
  }, [tab, page, q]);
  useEffect(load, [load]);

  const counts = useCommentCounts('order', rows.map((o) => o.docNum), selected);
  const canCreate = tab === 'received' && can('orders.create');
  const t = TABS[tab];

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-gray-500">{t.hint}</p>
        </div>
        {canCreate && <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Zakaz qo'shish</button>}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input !pl-10" placeholder="Ism, telefon yoki DocNum…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="Zakazlar topilmadi" /> : (<>
          {/* Phones: one compact card per order */}
          <ul className="divide-y divide-gray-100 lg:hidden">
            {rows.map((o) => (
              <li key={o.docNum} onClick={() => setSelected(o.docNum)} className="cursor-pointer px-4 py-3.5 transition-colors active:bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-bold text-brand-600">#{o.docNum}</span>
                  <span className="flex items-center gap-1.5">{o.kind === 'partner' && <SaygakBadge />}<StatusBadge s={o.status} partner={o.kind === 'partner'} /></span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{o.clientName}<CommentBadge n={counts[o.docNum]} /></span>
                  <span className="shrink-0 text-xs text-gray-500">{formatPhone(o.clientPhone)}</span>
                </div>
                {o.kind !== 'partner' && o.landmark && <div className="mt-1 flex items-start gap-1.5 text-sm text-gray-600"><MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" /><span className="min-w-0">{o.landmark}</span></div>}
                <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-gray-500">
                  {o.kind !== 'partner' ? <span className="shrink-0 tabular-nums">{o.pickupTime.slice(0, 16)}</span> : <span />}
                  <span className="min-w-0 truncate">{o.lines.map((l) => l.serviceName).join(', ')}</span>
                </div>
                {tab === 'completed' && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Jami <b className="text-gray-900">{fmtMoney(o.docTotal)}</b></span>
                    {o.debt > 0 ? <span className="font-semibold text-red-600">Qarz {fmtMoney(o.debt)}</span> : <span className="text-gray-400">Qarz yo'q</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto lg:block">
            <table className="rtable w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="th">№</th><th className="th">Mijoz</th><th className="th">Orientir</th>
                  <th className="th">Olib ketish</th><th className="th">Xizmatlar</th>
                  {(tab === 'completed') && <><th className="th !text-right">Jami</th><th className="th !text-right">Qarz</th></>}
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((o) => (
                  <tr key={o.docNum} onClick={() => setSelected(o.docNum)} className="cursor-pointer hover:bg-gray-50">
                    <td data-label="№" className="td font-semibold text-brand-600">{o.docNum}</td>
                    <td data-label="Mijoz" className="td"><div><div className="font-medium">{o.clientName}{o.kind === 'partner' && <> <SaygakBadge /></>}<CommentBadge n={counts[o.docNum]} /></div><div className="text-xs text-gray-500">{formatPhone(o.clientPhone)}</div></div></td>
                    <td data-label="Orientir" className="td text-gray-600">{o.kind === 'partner' ? '—' : o.landmark || '—'}</td>
                    <td data-label="Olib ketish" className="td whitespace-nowrap text-gray-600">{o.kind === 'partner' ? '—' : o.pickupTime.slice(0, 16)}</td>
                    <td data-label="Xizmatlar" className="td text-gray-600">{o.lines.map((l) => l.serviceName).join(', ')}</td>
                    {tab === 'completed' && <>
                      <td data-label="Jami" className="td text-right font-medium">{fmtMoney(o.docTotal)}</td>
                      <td data-label="Qarz" className={`td text-right ${o.debt > 0 ? 'font-medium text-red-600' : 'text-gray-400'}`}>{o.debt > 0 ? fmtMoney(o.debt) : '—'}</td>
                    </>}
                    <td data-label="Status" className="td"><StatusBadge s={o.status} partner={o.kind === 'partner'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
        <Pager page={meta.page} limit={meta.limit} total={meta.total} onChange={setPage} />
      </div>

      {creating && <CreateOrderModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setPage(1); load(); }} />}
      {selected && <OrderModal docNum={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}
