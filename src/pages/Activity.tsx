import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api';
import { describe, ENTITY_LABEL, type Activity } from '../activity';
import type { Page } from '../types';
import { Select } from '../components/fields';
import { Empty, Field, Loading, Pager } from '../components/ui';
import OrderModal from './OrderModal';

const ENTITIES = [{ value: '', label: 'Hammasi' }, ...Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label }))];

export default function ActivityPage() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 30, total: 0 });
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '30', entity, search: q, from, to });
    api<Page<Activity>>(`/activity?${p}`).then((r) => { setRows(r.data); setMeta(r.meta); }).finally(() => setLoading(false));
  }, [page, entity, q, from, to]);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Faoliyat jurnali</h1>
        <p className="text-sm text-gray-500">Kim, qachon, nimani o'zgartirgani</p>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Bo'lim"><Select className="min-w-44" value={entity} onChange={(v) => { setEntity(v); setPage(1); }} options={ENTITIES} /></Field>
        <Field label="Dan"><input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
        <Field label="Gacha"><input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input !pl-10" placeholder="Xodim, zakaz raqami, matn…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="Yozuvlar topilmadi" /> : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => {
              const d = describe(r);
              const isOrder = r.entity === 'order';
              return (
                <li key={r.id} className={`px-4 py-3 sm:px-5 ${isOrder ? 'cursor-pointer hover:bg-gray-50' : ''}`} onClick={isOrder ? () => setOrder(+r.entityId) : undefined}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <div className="text-sm">
                      <span className="mr-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {ENTITY_LABEL[r.entity] ?? r.entity}{isOrder ? ` #${r.entityId}` : ''}
                      </span>
                      <span className="font-semibold">{d.title}</span>
                    </div>
                    <span className="text-xs tabular-nums text-gray-400">{r.at.slice(0, 16)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">{r.userName}</div>
                  {d.lines.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-gray-600">{d.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={meta.page} limit={meta.limit} total={meta.total} onChange={setPage} />
      </div>
      {order && <OrderModal docNum={order} onClose={() => setOrder(null)} onChanged={load} />}
    </div>
  );
}
