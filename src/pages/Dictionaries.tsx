import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { UNITS, type DictItem, type Unit } from '../types';
import { NumberInput } from '../components/fields';
import { ErrorBox, Field, Modal } from '../components/ui';

export default function Dictionaries() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
      <Dict title="Xizmat turlari" path="/services" priced />
      <Dict title="Xarajat turlari" path="/expense-types" />
    </div>
  );
}

function Dict({ title, path, priced }: { title: string; path: string; priced?: boolean }) {
  const [items, setItems] = useState<DictItem[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<Unit>('kv.m');
  const [editing, setEditing] = useState<DictItem | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api<{ data: DictItem[] }>(`${path}?all=true`).then((r) => setItems(r.data));
  }, [path]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); load(); } catch (x) { setErr((x as Error).message); }
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api(path, { method: 'POST', body: priced ? { name, defaultPrice: +price || 0, unit } : { name } }); setName(''); setPrice(''); });
  };
  const rename = (it: DictItem) => {
    const n = window.prompt('Yangi nom', it.name);
    if (n && n !== it.name) run(() => api(`${path}/${it.id}`, { method: 'PATCH', body: { name: n } }));
  };

  return (
    <div className="card p-4">
      <h1 className="mb-3 text-lg font-semibold">{title}</h1>
      <ErrorBox msg={err} />
      <ul className="divide-y divide-gray-100 text-sm">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className={`flex-1 ${it.isActive ? '' : 'text-gray-400 line-through'}`}>{it.name}</span>
            {priced && (
              <button className="text-xs font-semibold text-gray-700 hover:underline" onClick={() => setEditing(it)} title="Narx va o'lchov birligini o'zgartirish">
                {(it.defaultPrice ?? 0).toLocaleString('ru-RU')} so'm/{it.unit ?? 'kv.m'}
              </button>
            )}
            <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => rename(it)}>Nomini o'zgartirish</button>
            <button className="text-xs font-semibold text-gray-500 hover:underline" onClick={() => run(() => api(`${path}/${it.id}`, { method: 'PATCH', body: { isActive: !it.isActive } }))}>
              {it.isActive ? "O'chirish" : 'Yoqish'}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input className="input" placeholder="Yangi nom" value={name} onChange={(e) => setName(e.target.value)} required />
        {priced && <NumberInput className="!w-36" min={0} placeholder={`Narx (1 ${unit})`} value={price} onChange={setPrice} />}
        {priced && <UnitPicker value={unit} onChange={setUnit} />}
        <button className="btn-primary">Qo'shish</button>
      </form>
      {editing && (
        <PriceModal item={editing} onClose={() => setEditing(null)} onSave={(defaultPrice, u) => {
          setEditing(null);
          run(() => api(`${path}/${editing.id}`, { method: 'PATCH', body: { defaultPrice, unit: u } }));
        }} />
      )}
    </div>
  );
}

function UnitPicker({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  return (
    <div role="radiogroup" aria-label="O'lchov birligi" className="flex shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-0.5">
      {UNITS.map((u) => (
        <button key={u} type="button" role="radio" aria-checked={value === u} onClick={() => onChange(u)}
          className={`rounded-[10px] px-3 text-sm font-medium transition ${value === u ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
          {u}
        </button>
      ))}
    </div>
  );
}

function PriceModal({ item, onClose, onSave }: { item: DictItem; onClose: () => void; onSave: (price: number, unit: Unit) => void }) {
  const [price, setPrice] = useState(String(item.defaultPrice ?? 0));
  const [unit, setUnit] = useState<Unit>(item.unit ?? 'kv.m');
  return (
    <Modal title={item.name} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(+price || 0, unit); }} className="space-y-4">
        <Field label="O'lchov birligi"><UnitPicker value={unit} onChange={setUnit} /></Field>
        <Field label={`Standart narx (1 ${unit})`}><NumberInput min={0} value={price} onChange={setPrice} autoFocus /></Field>
        <p className="text-xs text-gray-500">Birlikni o'zgartirish faqat yangi zakazlarga ta'sir qiladi. Mavjud zakazlar o'z birligida qoladi.</p>
        <button className="btn-primary w-full">Saqlash</button>
      </form>
    </Modal>
  );
}
