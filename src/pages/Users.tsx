import { Select } from '../components/fields';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { ManagedUser, Role, RoleInfo } from '../types';
import { Empty, ErrorBox, Field, Loading, Modal } from '../components/ui';

export default function Users() {
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<ManagedUser | 'new' | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  useEffect(() => { api<{ data: RoleInfo[] }>('/roles').then((r) => setRoles(r.data)); }, []);
  const roleName = (k: string) => roles.find((r) => r.key === k)?.name ?? k;

  const load = useCallback(() => {
    api<{ data: ManagedUser[] }>('/users').then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Foydalanuvchilar</h1>
        <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={18} /> Qo'shish</button>
      </div>
      <div className="card overflow-hidden">
        {loading ? <Loading /> : (
          <div className="overflow-x-auto">
            <table className="rtable w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr><th className="th">Login</th><th className="th">Ism</th><th className="th">Rol</th><th className="th">Holat</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((u) => (
                  <tr key={u.id} onClick={() => setEdit(u)} className="cursor-pointer hover:bg-gray-50">
                    <td data-label="Login" className="td font-medium">{u.username}</td>
                    <td data-label="Ism" className="td">{u.fullName}</td>
                    <td data-label="Rol" className="td">{roleName(u.role)}</td>
                    <td data-label="Holat" className="td">{u.isActive ? <span className="text-green-700">Faol</span> : <span className="text-gray-400">O'chirilgan</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <UserModal roles={roles} user={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function UserModal({ roles, user, onClose, onSaved }: { roles: RoleInfo[]; user: ManagedUser | null; onClose: () => void; onSaved: () => void }) {
  const { user: me } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? 'operator');
  const [active, setActive] = useState(user?.isActive ?? true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const self = !!user && user.id === me!.id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (user) {
        await api(`/users/${user.id}`, { method: 'PATCH', body: { fullName, role, isActive: active, ...(password && { password }) } });
      } else {
        await api('/users', { method: 'POST', body: { username, fullName, password, role } });
      }
      onSaved();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <Modal title={user ? user.username : 'Yangi foydalanuvchi'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox msg={err} />
        {!user && <Field label="Login (3–50 belgi)"><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9_.\-]+" /></Field>}
        <Field label="To'liq ism"><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></Field>
        <Field label={user ? "Yangi parol (o'zgartirmaslik uchun bo'sh qoldiring)" : 'Parol (kamida 8 belgi)'}>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!user} minLength={8} />
        </Field>
        <Field label="Rol">
          <Select value={role} onChange={(v) => setRole(v as Role)} disabled={self} options={roles.map((r) => ({ value: r.key, label: r.name }))} />
        </Field>
        {user && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={self} /> Faol
          </label>
        )}
        {self && <p className="text-xs text-gray-500">O'z hisobingizni o'chirib yoki rolini pasaytirib bo'lmaydi.</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
      </form>
    </Modal>
  );
}
