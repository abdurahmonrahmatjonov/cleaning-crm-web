import { useEffect, useState } from 'react';
import { api } from '../api';
import { describe, type Activity } from '../activity';

/** Who did what to this order, newest last. `refreshKey` reloads it after a change. */
export default function OrderHistory({ docNum, refreshKey, bare }: { docNum: number; refreshKey?: unknown; bare?: boolean }) {
  const [rows, setRows] = useState<Activity[] | null>(null);
  useEffect(() => {
    api<{ data: Activity[] }>(`/orders/${docNum}/history`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [docNum, refreshKey]);

  return (
    <div className={bare ? '' : 'mt-5 border-t border-gray-100 pt-4'}>
      <h3 className={`mb-3 text-sm font-semibold ${bare ? 'sr-only' : ''}`}>Tarix</h3>
      {rows === null ? <div className="text-sm text-gray-400">Yuklanmoqda…</div>
        : rows.length === 0 ? <div className="text-sm text-gray-400">Bu zakaz uchun yozuvlar yo'q (jurnal yuritilishidan oldin yaratilgan)</div> : (
        <ol className="relative space-y-4 border-l border-gray-200 pl-5">
          {rows.map((r) => {
            const d = describe(r);
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-semibold">{d.title}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{r.at.slice(0, 16)}</span>
                </div>
                <div className="text-xs text-gray-500">{r.userName}</div>
                {d.lines.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-gray-600">{d.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
