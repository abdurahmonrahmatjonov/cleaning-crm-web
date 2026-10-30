import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { ErrorBox, Field } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';
import { BrandMark, DEFAULT_LOGIN_SUBTITLE, DEFAULT_LOGIN_TITLE, useBranding } from '../branding';

export default function Login() {
  const { login } = useAuth();
  const { name, loginTitle, loginSubtitle, loginBackground, loginColor } = useBranding();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(u, p); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen bg-gray-100 lg:grid-cols-[1.1fr_1fr]">
      <aside
        className={`relative flex min-h-48 flex-col justify-between overflow-hidden p-6 text-snow sm:p-10 lg:min-h-screen ${loginColor || loginBackground ? '' : 'weave'}`}
        style={{
          ...(loginColor ? { backgroundColor: loginColor } : {}),
          ...(loginBackground ? { backgroundImage: `url(${loginBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
        }}
      >
        {loginBackground && <div aria-hidden className="absolute inset-0 bg-black/45" />}
        <div className="relative flex items-center gap-2.5">
          <BrandMark size={36} saffron />
          <span className="font-display text-xl font-bold">{name}</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{loginTitle ?? DEFAULT_LOGIN_TITLE}</h1>
          <p className="mt-3 hidden text-snow/75 sm:block">{loginSubtitle ?? DEFAULT_LOGIN_SUBTITLE}</p>
        </div>
      </aside>

      <main className="relative grid place-items-center p-4 sm:p-8">
        <div className="absolute right-3 top-3"><ThemeToggle /></div>
        <form onSubmit={submit} className="anim-page w-full max-w-sm space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Kirish</h2>
            <p className="mt-1 text-sm text-gray-500">Login va parolingizni kiriting</p>
          </div>
          <ErrorBox msg={err} />
          <Field label="Login"><input className="input" value={u} onChange={(e) => setU(e.target.value)} autoFocus required /></Field>
          <Field label="Parol"><input className="input" type="password" value={p} onChange={(e) => setP(e.target.value)} required /></Field>
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Kirilmoqda…' : 'Kirish'}</button>
        </form>
      </main>
    </div>
  );
}
