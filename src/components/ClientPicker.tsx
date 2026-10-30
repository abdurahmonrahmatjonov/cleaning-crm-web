import { useEffect, useRef, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { api } from '../api';
import { formatPhone } from '../format';
import type { Client, Page } from '../types';

/** Search existing clients by name or phone (server side, so it works with thousands of clients). */
export default function ClientPicker({ onPick }: { onPick: (c: Client) => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    const t = setTimeout(() => {
      api<Page<Client>>(`/clients?page=1&limit=8&search=${encodeURIComponent(q.trim())}`)
        .then((r) => { setRows(r.data); setHi(0); }).catch(() => setRows([])).finally(() => setBusy(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (c: Client) => { setOpen(false); setQ(''); onPick(c); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[hi]) pick(rows[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        className="input !pl-10" placeholder="Mijoz ismi yoki telefon raqami…" value={q} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={key}
        role="combobox" aria-expanded={open} aria-autocomplete="list"
      />
      {open && (
        <div role="listbox" className="anim-menu absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {rows.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">{busy ? 'Qidirilmoqda…' : 'Mijoz topilmadi'}</div>}
          {rows.map((c, i) => (
            <button key={c.id} type="button" role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onClick={() => pick(c)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${i === hi ? 'bg-brand-50' : ''}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><UserRound size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block text-xs text-gray-500">{formatPhone(c.phone)} · {c.ordersCount} ta zakaz</span>
              </span>
              {c.debt > 0 && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">qarz</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
