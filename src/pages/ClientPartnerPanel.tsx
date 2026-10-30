import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { ClientDetail, ClientPrice } from '../types';
import { ErrorBox, Field, Loading } from '../components/ui';
import { NumberInput } from '../components/fields';
import { PartnerMoney } from './ClientPartnerMoney';

/** Accessible on/off switch. */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}>
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** Staff tools for a saygak (partner) client: prices, login, lump payments, history, statement. */
export default function ClientPartnerPanel({ client, onChanged }: { client: ClientDetail; onChanged: () => void }) {
  return (
    <div className="mb-5 space-y-4">
      <PricesCard clientId={client.id} />
      <LoginCard clientId={client.id} />
      <PartnerMoney clientId={client.id} onChanged={onChanged} />
    </div>
  );
}

const card = 'rounded-xl border border-gray-200 p-3';

function PricesCard({ clientId }: { clientId: number }) {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<ClientPrice[] | null>(null);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = (r: ClientPrice[]) => {
    setRows(r);
    setVals(Object.fromEntries(r.map((x) => [x.serviceId, x.price === null ? '' : String(x.price)])));
  };
  useEffect(() => {
    let live = true;
    api<{ data: ClientPrice[] }>(`/clients/${clientId}/prices`)
      .then((r) => live && apply(r.data))
      .catch((x) => live && (setErr((x as Error).message), setRows([])));
    return () => { live = false; };
  }, [clientId]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!rows) return;
    const prices = rows.filter((r) => vals[r.serviceId] !== '').map((r) => ({ serviceId: r.serviceId, price: Number(vals[r.serviceId]) }));
    if (prices.some((p) => p.price <= 0)) return setErr("Narx 0 bo'lishi mumkin emas. Narxsiz xizmatni bo'sh qoldiring");
    setBusy(true); setErr(''); setOk(false);
    try {
      const r = await api<{ data: ClientPrice[] }>(`/clients/${clientId}/prices`, { method: 'PUT', body: { prices } });
      apply(r.data); setOk(true);
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };

  return (
    <form onSubmit={save} className={card}>
      <h3 className="mb-2 text-sm font-semibold">Narxlar</h3>
      <ErrorBox msg={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <div className="text-sm text-gray-400">Xizmatlar yo'q</div> : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.serviceId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.serviceName} <span className="text-xs text-gray-400">/ {r.unit}</span></span>
              {isAdmin ? (
                <NumberInput className="!w-36 text-right" aria-label={`${r.serviceName} narxi`} placeholder="Narxsiz" min={1} max={1e9}
                  value={vals[r.serviceId] ?? ''} onChange={(v) => { setVals({ ...vals, [r.serviceId]: v }); setOk(false); }} />
              ) : (
                <span className={r.price === null ? 'text-gray-400' : 'font-medium'}>{r.price === null ? 'Narxsiz' : r.price.toLocaleString('ru-RU')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && rows && rows.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <button className="btn-primary !h-9 !px-4" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
          {ok && <span className="text-sm text-green-600">Saqlandi</span>}
        </div>
      )}
    </form>
  );
}

interface Login { username: string; isActive: boolean }

function LoginCard({ clientId }: { clientId: number }) {
  const { isAdmin } = useAuth();
  const [login, setLogin] = useState<Login | null | undefined>(undefined); // undefined = loading
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setLogin(undefined); return; }
    let live = true;
    api<Login | null>(`/clients/${clientId}/login`)
      .then((r) => live && setLogin(r))
      .catch((x) => live && (setErr((x as Error).message), setLogin(null)));
    return () => { live = false; };
  }, [clientId, isAdmin]);

  const run = async (method: string, body: object, msg: string) => {
    setBusy(true); setErr(''); setOk('');
    try {
      setLogin(await api<Login>(`/clients/${clientId}/login`, { method, body }));
      setOk(msg); setPassword(''); setShow(false); setResetting(false);
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setErr("Parol kamida 8 belgi bo'lsin");
    run('PUT', { username: username.trim(), password }, login ? 'Parol yangilandi' : 'Login yaratildi');
  };

  // The login endpoints are admin only; other staff just see a note.
  if (!isAdmin) return <div className={card}><h3 className="mb-1 text-sm font-semibold">Login</h3><div className="text-sm text-gray-500">Loginni faqat admin boshqaradi</div></div>;

  const form = (
    <form onSubmit={submit} className="space-y-3" autoComplete="off">
      <Field label="Login (3–50 belgi: harf, raqam, _ . -)">
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={50}
          pattern="[\w.\-]+" autoComplete="off" readOnly={!!login} />
      </Field>
      <Field label="Parol (kamida 8 belgi)">
        <div className="relative">
          <input className="input !pr-11" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} maxLength={100} autoComplete="new-password" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Yashirish' : "Ko'rsatish"}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-500 hover:bg-gray-100">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>
      <div className="flex gap-2">
        <button className="btn-primary !h-9 !px-4" disabled={busy}>{busy ? 'Saqlanmoqda…' : login ? 'Parolni saqlash' : 'Login yaratish'}</button>
        {login && <button type="button" className="btn-ghost !h-9 !px-3" onClick={() => { setResetting(false); setPassword(''); }}>Bekor</button>}
      </div>
    </form>
  );

  return (
    <div className={card}>
      <h3 className="mb-2 text-sm font-semibold">Login</h3>
      <ErrorBox msg={err} />
      {ok && <div className="mb-2 text-sm text-green-600">{ok}</div>}
      {login === undefined ? <Loading /> : !login ? form : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Login: <b>{login.username}</b></span>
            <label className="flex items-center gap-2">
              <span className={login.isActive ? 'text-green-600' : 'text-gray-400'}>{login.isActive ? 'Faol' : 'Faol emas'}</span>
              <Switch label="Login faol" checked={login.isActive} disabled={busy} onChange={(v) => run('PATCH', { isActive: v }, v ? 'Login faollashtirildi' : "Login o'chirildi")} />
            </label>
          </div>
          {resetting ? form : (
            <button className="btn-ghost !h-9 !px-3" onClick={() => { setUsername(login.username); setResetting(true); setOk(''); }}>Parolni yangilash</button>
          )}
        </div>
      )}
    </div>
  );
}
