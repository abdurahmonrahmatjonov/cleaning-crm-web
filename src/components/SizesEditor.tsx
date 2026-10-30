import { Plus, X } from 'lucide-react';
import type { Line } from '../types';
import { NumberInput } from './fields';
import { formatNumber } from '../format';

export interface SizeRow { width: string; length: string }

/** Same rounding as the backend: 2 decimals, per value and per row. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const rowsFromLine = (l: Line): SizeRow[] => l.sizes.map((s) => ({ width: String(s.width), length: String(s.length) }));

export const rowArea = (r: SizeRow): number => {
  const w = round2(+r.width), l = round2(+r.length);
  return w > 0 && l > 0 ? round2(w * l) : 0;
};

export const rowsTotal = (rows: SizeRow[]): number => round2(rows.reduce((s, r) => s + rowArea(r), 0));

/** Complete rows only (both values positive), as numbers for the API. */
export const rowsPayload = (rows: SizeRow[]): { width: number; length: number }[] =>
  rows.filter((r) => rowArea(r) > 0).map((r) => ({ width: +r.width, length: +r.length }));

/** Per-carpet sizes (eni × bo'yi) for one kv.m line, with a live area total. */
export default function SizesEditor({ rows, onChange, pieces }: {
  rows: SizeRow[]; onChange: (r: SizeRow[]) => void; pieces: number;
}) {
  const set = (i: number, patch: Partial<SizeRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const count = rowsPayload(rows).length;
  return (
    <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-semibold text-gray-600">O'lchamlar (eni × bo'yi, m)</div>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <NumberInput decimal max={100} className="!w-24" value={r.width} onChange={(v) => set(i, { width: v })} placeholder="eni" aria-label="Eni (m)" />
          <span className="text-gray-400">×</span>
          <NumberInput decimal max={100} className="!w-24" value={r.length} onChange={(v) => set(i, { length: v })} placeholder="bo'yi" aria-label="Bo'yi (m)" />
          <span className="min-w-16 flex-1 text-sm tabular-nums text-gray-600">= {formatNumber(rowArea(r).toFixed(2))} kv.m</span>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-red-600"
            aria-label="O'chirish" onClick={() => onChange(rows.filter((_, j) => j !== i))}><X size={18} /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-ghost inline-flex min-h-10 items-center gap-1" onClick={() => onChange([...rows, { width: '', length: '' }])}>
          <Plus size={16} />Gilam qo'shish
        </button>
        <span className="text-sm font-semibold tabular-nums">Jami: {formatNumber(rowsTotal(rows).toFixed(2))} kv.m</span>
      </div>
      {rows.length > 0 && count !== pieces && <p className="text-xs text-amber-600">{count} ta o'lcham, {pieces} dona</p>}
    </div>
  );
}
