import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Empty, ErrorBox, Loading, Pager, StatusBadge } from '../../components/ui';
import type { Page, PartnerOrder } from '../../types';
import PartnerOrderDetail from './PartnerOrderDetail';
import { fmtMoneyExact as money } from '../../format';

export default function PartnerOrders({ onChanged }: { onChanged: () => void }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [created] = useState(() => (loc.state as { created?: number } | null)?.created);
  useEffect(() => { if (created != null) nav('.', { replace: true, state: null }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PartnerOrder[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr('');
    api<Page<PartnerOrder>>(`/partner/orders?page=${page}&limit=20`)
      .then((r) => { if (alive) { setRows(r.data); setMeta(r.meta); } })
      .catch((e) => { if (alive) { setErr((e as Error).message); setRows((x) => x ?? []); } });
    return () => { alive = false; };
  }, [page, tick]);

  return (
    <div className="space-y-3">
      {created != null && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Buyurtma №{created} qabul qilindi.</div>}
      <ErrorBox msg={err} />
      <div className="card overflow-hidden">
        {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="Buyurtmalar yo'q" /> : (
          <ul className="divide-y divide-gray-100">
            {rows.map((o) => (
              <li key={o.docNum}>
                <button onClick={() => setSel(o.docNum)}
                  className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${o.docNum === created ? 'bg-brand-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">№{o.docNum}</div>
                    <div className="text-xs text-gray-500">{o.createdAt} · {o.lines.length} ta xizmat</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge s={o.status} partner />
                    {o.docTotal != null && <span className="text-sm font-medium">{money(o.docTotal)}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pager page={meta.page} limit={meta.limit} total={meta.total} onChange={setPage} />
      </div>
      {sel != null && <PartnerOrderDetail docNum={sel} onClose={() => setSel(null)} onChanged={() => { setTick((t) => t + 1); onChanged(); }} />}
    </div>
  );
}
