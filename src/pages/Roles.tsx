import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Lock, Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import { api } from '../api';
import type { Permission, RoleInfo } from '../types';
import { ErrorBox, Field, Loading, Modal } from '../components/ui';

const GROUPS: { title: string; items: { key: Permission; label: string }[] }[] = [
  {
    title: 'Zakazlar',
    items: [
      { key: 'orders.view', label: "Zakazlarni ko'rish" },
      { key: 'orders.create', label: 'Zakaz yaratish' },
      { key: 'orders.edit', label: 'Tahrirlash va bekor qilish' },
      { key: 'orders.pickup', label: 'Olib ketish (nakladnoy)' },
      { key: 'orders.wash', label: "Yuvib bo'lindi deb belgilash" },
      { key: 'orders.pack', label: 'Upakovka qilindi deb belgilash' },
      { key: 'orders.deliver', label: 'Yetkazib berish' },
      { key: 'orders.payments', label: "Qarz to'lovini qabul qilish" },
      { key: 'orders.discount', label: 'Chegirma berish' },
    ],
  },
  {
    title: 'Mijozlar va moliya',
    items: [
      { key: 'clients.view', label: "Mijozlarni ko'rish" },
      { key: 'clients.manage', label: "Mijoz qo'shish, tahrirlash, o'chirish" },
      { key: 'debtors.view', label: 'Qarzdorlar' },
      { key: 'expenses.manage', label: 'Xarajatlar' },
      { key: 'reports.view', label: 'Hisobot' },
    ],
  },
];

export default function Roles() {
  const [roles, setRoles] = useState<RoleInfo[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api<{ data: RoleInfo[] }>('/roles').then((r) => setRoles(r.data)).catch((x) => setErr((x as Error).message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rollar va huquqlar</h1>
          <p className="text-sm text-gray-500">Har bir rol nimalarni qila olishini belgilang. Admin doim hamma narsaga ega.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} /> Yangi rol</button>
      </div>
      <ErrorBox msg={err} />
      {!roles ? <Loading /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => <RoleCard key={r.key} role={r} onChanged={load} />)}
        </div>
      )}
      {adding && <NewRole onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function PermissionList({ value, onToggle, disabled }: { value: Permission[]; onToggle: (p: Permission) => void; disabled?: boolean }) {
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 text-xs font-semibold text-gray-400">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <label key={it.key} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${disabled ? 'opacity-70' : 'cursor-pointer hover:bg-gray-50'}`}>
                <input type="checkbox" checked={value.includes(it.key)} disabled={disabled} onChange={() => onToggle(it.key)} />
                {it.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const toggle = (list: Permission[], p: Permission) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);

function RoleCard({ role, onChanged }: { role: RoleInfo; onChanged: () => void }) {
  const locked = role.key === 'admin';
  const [name, setName] = useState(role.name);
  const [perms, setPerms] = useState<Permission[]>(role.permissions);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = name !== role.name || perms.length !== role.permissions.length || perms.some((p) => !role.permissions.includes(p));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); onChanged(); setSaved(true); setTimeout(() => setSaved(false), 1500); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="card flex flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        {locked ? <h2 className="flex-1 text-lg font-semibold">{role.name}</h2> : (
          <input className="input !h-10 flex-1 font-semibold" value={name} onChange={(e) => setName(e.target.value)} aria-label="Rol nomi" />
        )}
        {locked && <Lock size={16} className="text-gray-400" aria-label="O'zgartirib bo'lmaydi" />}
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"><UsersIcon size={12} />{role.usersCount}</span>
      </div>
      <PermissionList value={perms} disabled={locked} onToggle={(p) => setPerms((l) => toggle(l, p))} />
      <div className="mt-auto pt-4">
        <ErrorBox msg={err} />
        {!locked && (
          <div className="mt-3 flex items-center gap-2">
            <button className="btn-primary flex-1" disabled={!dirty || busy || name.trim().length < 2}
              onClick={() => run(() => api(`/roles/${role.key}`, { method: 'PATCH', body: { name: name.trim(), permissions: perms } }))}>
              {saved ? 'Saqlandi' : busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
            {!role.isSystem && (
              <button className="btn-ghost !px-3 !text-red-600" aria-label="Rolni o'chirish" disabled={busy}
                onClick={() => window.confirm(`"${role.name}" rolini o'chirasizmi?`) && run(() => api(`/roles/${role.key}`, { method: 'DELETE' }))}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
        {locked && <p className="text-xs text-gray-500">Admin roli o'zgartirilmaydi.</p>}
      </div>
    </section>
  );
}

function NewRole({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<Permission[]>(['orders.view']);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await api('/roles', { method: 'POST', body: { name: name.trim(), permissions: perms } }); onSaved(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <Modal title="Yangi rol" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox msg={err} />
        <Field label="Rol nomi"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} autoFocus /></Field>
        <PermissionList value={perms} onToggle={(p) => setPerms((l) => toggle(l, p))} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : "Rol qo'shish"}</button>
      </form>
    </Modal>
  );
}
