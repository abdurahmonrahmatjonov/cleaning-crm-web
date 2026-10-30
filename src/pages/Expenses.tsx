import { NumberInput, Select } from '../components/fields';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api, fmtMoney, todayStr } from '../api';
import type { Expense, Named, Page } from '../types';
import { Empty, ErrorBox, Field, Modal, Pager } from '../components/ui';
import Comments, { CommentBadge, useCommentCounts } from '../components/Comments';

const creatorName = (c: Expense['creator']) => (typeof c === 'string' ? c : c?.name);

export default function Expenses() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [meta, setMeta] = useState<Page<Expense>['meta']>({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [types, setTypes] = useState<Named[]>([]);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [typeF, setTypeF] = useState('');
  const [commenting, setCommenting] = useState<Expense | null>(null);
  const [bump, setBump] = useState(0);
  const counts = useCommentCounts('expense', rows.map((e) => e.id), bump);

  const load = useCallback(() => {
    api<Page<Expense>>(`/expenses?page=${page}&limit=20&from=${from}&to=${to}&expenseTypeId=${typeF}`).then((r) => { setRows(r.data); setMeta(r.meta); });
  }, [page, from, to, typeF]);
  useEffect(load, [load]);
  useEffect(() => { api<{ data: Named[] }>('/expense-types').then((r) => setTypes(r.data)); }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Xarajatlar</h1>
          <p className="text-sm text-gray-500">Jami: <b className="text-gray-800">{fmtMoney(meta.totalAmount ?? 0)}</b></p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Xarajat qo'shish</button>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Dan"><input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
        <Field label="Gacha"><input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
        <Field label="Turi">
          <Select className="min-w-48" value={typeF} onChange={(v) => { setTypeF(v); setPage(1); }} options={[{ value: '', label: 'Hammasi' }, ...types.map((t) => ({ value: String(t.id), label: t.name }))]} />
        </Field>
      </div>
      <div className="card overflow-hidden">
        {rows.length === 0 ? <Empty text="Hali xarajatlar yo'q" /> : (
          <div className="overflow-x-auto">
            <table className="rtable w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr><th className="th">Sana</th><th className="th">Turi</th><th className="th !text-right">Summa</th><th className="th">Kiritdi</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((e) => (
                  <tr key={e.id} onClick={() => setCommenting(e)} className="cursor-pointer hover:bg-gray-50/60">
                    <td data-label="Sana" className="td text-gray-500">{e.expenseDate}</td>
                    <td data-label="Turi" className="td"><span className="text-gray-700">{e.expenseType}</span><CommentBadge n={counts[e.id]} /></td>
                    <td data-label="Summa" className="td text-right font-semibold">{fmtMoney(e.amount)}</td>
                    <td data-label="Kiritdi" className="td text-gray-500">{creatorName(e.creator)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={meta.page} limit={meta.limit} total={meta.total} onChange={setPage} />
      </div>
      {commenting && (
        <Modal title={`${commenting.expenseType} · ${fmtMoney(commenting.amount)}`} onClose={() => setCommenting(null)}>
          <div className="text-sm text-gray-500">{commenting.expenseDate} · {creatorName(commenting.creator)}</div>
          <Comments entity="expense" entityId={commenting.id} onChange={() => setBump((b) => b + 1)} />
        </Modal>
      )}
      {open && <ExpenseModal types={types} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setPage(1); load(); }} />}
    </div>
  );
}

function ExpenseModal({ types, onClose, onSaved }: { types: Named[]; onClose: () => void; onSaved: () => void }) {
  const [typeId, setTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api('/expenses', { method: 'POST', body: { expenseTypeId: +typeId, amount: +amount, expenseDate: date } });
      onSaved();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <Modal title="Yangi xarajat" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox msg={err} />
        <Field label="Xarajat turi">
          <Select required value={typeId} onChange={setTypeId} options={types.map((t) => ({ value: String(t.id), label: t.name }))} />
        </Field>
        <Field label="Summa (so'm)"><NumberInput min={1} value={amount} onChange={setAmount} required /></Field>
        <Field label="Sana"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
      </form>
    </Modal>
  );
}
