import { useRef, useState } from 'react';
import { Check, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../auth';
import { BrandMark, DEFAULT_LOGIN_SUBTITLE, DEFAULT_LOGIN_TITLE, useBranding } from '../branding';
import { ErrorBox } from '../components/ui';
import { ACCENTS, FONTS, resetAppearance, setAppearance, useAppearance, type Nav, type Radius } from '../appearance';
import { toggleTheme, useTheme } from '../theme';

const pick = (on: boolean) =>
  `relative rounded-xl border-2 p-3 text-left transition active:scale-[0.98] ${on ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'}`;

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card p-5">
    <h2 className="text-base font-semibold">{title}</h2>
    {hint && <p className="mb-4 mt-0.5 text-sm text-gray-500">{hint}</p>}
    {!hint && <div className="mb-4" />}
    {children}
  </section>
);

const Tick = () => <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-snow"><Check size={12} strokeWidth={3} /></span>;

// Tiny wireframes of each layout
function Wire({ kind }: { kind: Nav }) {
  const bar = 'rounded bg-gray-300';
  return (
    <div className="mb-2 h-20 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 p-1.5">
      {kind === 'top' && (<><div className="flex h-3 items-center gap-1 rounded-sm bg-white px-1"><span className={`h-1.5 w-3 ${bar}`} /><span className={`h-1 w-2 ${bar}`} /><span className={`h-1 w-2 ${bar}`} /></div><div className="mt-1.5 h-8 rounded bg-white" /></>)}
      {kind === 'island' && (<><div className="mx-auto flex h-3.5 w-4/5 items-center gap-1 rounded-full bg-white px-2 shadow"><span className={`h-1.5 w-3 ${bar}`} /><span className={`h-1 w-2 ${bar}`} /></div><div className="mt-2 h-8 rounded bg-white" /></>)}
      {kind === 'sidebar' && (<div className="flex h-full gap-1.5"><div className="flex w-1/4 flex-col gap-1 rounded-sm bg-white p-1"><span className={`h-1.5 w-full ${bar}`} /><span className={`h-1 w-3/4 ${bar}`} /><span className={`h-1 w-3/4 ${bar}`} /></div><div className="flex-1 rounded bg-white" /></div>)}
    </div>
  );
}

/** Downscale an uploaded image to fit `max` px and re-encode it so what we store stays small. */
function shrink(file: File, max: number, type: 'image/png' | 'image/jpeg', quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Rasm o'qib bo'lmadi")); };
    img.src = url;
  });
}

function BrandingSection() {
  const { name, logo, save } = useBranding();
  const [n, setN] = useState(name);
  const [l, setL] = useState<string | null>(logo);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const dirty = n.trim() !== name || l !== logo;

  const pick = async (f?: File) => {
    if (!f) return;
    setErr('');
    if (!f.type.startsWith('image/')) return setErr('Faqat rasm fayli yuklang');
    try { setL(await shrink(f, 256, 'image/png')); } catch (x) { setErr((x as Error).message); }
  };
  const submit = async () => {
    setBusy(true); setErr('');
    try { await save({ name: n.trim(), logo: l }); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <Section title="Loyiha" hint="Nomi va logotipi menyuda, kirish sahifasida va brauzer sarlavhasida ko'rinadi">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-2xl border border-gray-200 bg-gray-50">
          {l ? <img src={l} alt="Logotip" className="h-16 w-16 rounded-lg object-contain" /> : <BrandMark size={56} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-ghost" onClick={() => file.current?.click()}><ImagePlus size={16} /> Logotip yuklash</button>
          {l && <button type="button" className="btn-ghost !text-red-600" onClick={() => setL(null)}><Trash2 size={16} /> Olib tashlash</button>}
        </div>
      </div>
      <div className="mt-4 max-w-sm">
        <label className="label" htmlFor="project-name">Loyiha nomi</label>
        <input id="project-name" className="input" value={n} maxLength={60} onChange={(e) => setN(e.target.value)} />
      </div>
      <div className="mt-4"><ErrorBox msg={err} /></div>
      <button className="btn-primary mt-4" disabled={!dirty || busy || !n.trim()} onClick={submit}>{done ? 'Saqlandi' : busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
    </Section>
  );
}

function LoginBannerSection() {
  const b = useBranding();
  const [title, setTitle] = useState(b.loginTitle ?? '');
  const [sub, setSub] = useState(b.loginSubtitle ?? '');
  const [bg, setBg] = useState<string | null>(b.loginBackground);
  const [color, setColor] = useState<string | null>(b.loginColor);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const dirty = title.trim() !== (b.loginTitle ?? '') || sub.trim() !== (b.loginSubtitle ?? '') || bg !== b.loginBackground || color !== b.loginColor;

  const pick = async (f?: File) => {
    if (!f) return;
    setErr('');
    if (!f.type.startsWith('image/')) return setErr('Faqat rasm fayli yuklang');
    try {
      // JPEG at 1600px keeps a photo well under the server limit; step down if it is still too big
      for (const [max, q] of [[1600, 0.8], [1200, 0.7], [900, 0.6]] as const) {
        const url = await shrink(f, max, 'image/jpeg', q);
        if (url.length < 650_000) return setBg(url);
      }
      setErr('Rasm juda katta, kichikroq rasm tanlang');
    } catch (x) { setErr((x as Error).message); }
  };
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await b.save({ loginTitle: title.trim() || null, loginSubtitle: sub.trim() || null, loginBackground: bg, loginColor: color });
      setDone(true); setTimeout(() => setDone(false), 1500);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const reset = () => { setTitle(''); setSub(''); setBg(null); setColor(null); };

  return (
    <Section title="Kirish sahifasi" hint="Kirish oynasining chap tomonidagi banner: matn, fon rasmi va rang">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="login-title">Sarlavha</label>
            <textarea id="login-title" className="input" rows={3} maxLength={160} placeholder={DEFAULT_LOGIN_TITLE} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="login-sub">Qisqa matn</label>
            <input id="login-sub" className="input" maxLength={200} placeholder={DEFAULT_LOGIN_SUBTITLE} value={sub} onChange={(e) => setSub(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="btn-ghost" onClick={() => file.current?.click()}><ImagePlus size={16} /> Fon rasmi</button>
            {bg && <button type="button" className="btn-ghost !text-red-600" onClick={() => setBg(null)}><Trash2 size={16} /> Rasmni olib tashlash</button>}
          </div>
          <div className="flex items-center gap-3">
            <label className="label !mb-0" htmlFor="login-color">Fon rangi</label>
            <input id="login-color" type="color" value={color ?? '#0a4c4f'} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 bg-transparent p-1" />
            {color && <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setColor(null)}>Standart</button>}
          </div>
        </div>

        {/* Live preview of the banner */}
        <div
          className={`relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl p-5 text-snow ${color || bg ? '' : 'weave'}`}
          style={{ ...(color ? { backgroundColor: color } : {}), ...(bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }}
        >
          {bg && <div aria-hidden className="absolute inset-0 bg-black/45" />}
          <div className="relative flex items-center gap-2"><BrandMark size={24} saffron /><span className="font-display text-sm font-bold">{b.name}</span></div>
          <div className="relative">
            <div className="font-display text-xl font-bold leading-tight">{title.trim() || DEFAULT_LOGIN_TITLE}</div>
            <div className="mt-1 text-xs text-snow/75">{sub.trim() || DEFAULT_LOGIN_SUBTITLE}</div>
          </div>
        </div>
      </div>
      <div className="mt-4"><ErrorBox msg={err} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-primary" disabled={!dirty || busy} onClick={submit}>{done ? 'Saqlandi' : busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        <button className="btn-ghost" disabled={busy} onClick={reset}>Standart holatga</button>
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const a = useAppearance();
  const dark = useTheme() === 'dark';
  const navs: { id: Nav; label: string; hint: string }[] = [
    { id: 'top', label: 'Yuqori panel', hint: 'Klassik, hamma narsa bir qatorda' },
    { id: 'island', label: 'Island', hint: 'Suzuvchi yumaloq panel' },
    { id: 'sidebar', label: 'Yon panel', hint: "Ko'p bo'limlar uchun qulay" },
  ];
  const radii: { id: Radius; label: string }[] = [
    { id: 'sharp', label: "Qirrali" }, { id: 'soft', label: 'Yumshoq' }, { id: 'round', label: 'Yumaloq' },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sozlamalar</h1>
          <p className="text-sm text-gray-500">Ko'rinish shu brauzerda saqlanadi</p>
        </div>
        <button className="btn-ghost" onClick={resetAppearance}><RotateCcw size={16} /> Asl holatiga qaytarish</button>
      </div>

      {isAdmin && <BrandingSection />}
      {isAdmin && <LoginBannerSection />}

      <Section title="Menyu uslubi" hint="Navigatsiya qayerda va qanday ko'rinishda bo'lishini tanlang">
        <div className="grid gap-3 sm:grid-cols-3">
          {navs.map((n) => (
            <button key={n.id} onClick={() => setAppearance({ nav: n.id })} className={pick(a.nav === n.id)} aria-pressed={a.nav === n.id}>
              {a.nav === n.id && <Tick />}
              <Wire kind={n.id} />
              <div className="text-sm font-semibold">{n.label}</div>
              <div className="text-xs text-gray-500">{n.hint}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Pastki panel" hint="Asosiy bo'limlar uchun suzuvchi pastki menyu. Island rejimida doim yoqilgan">
        <button
          role="switch"
          aria-checked={a.dock || a.nav === 'island'}
          disabled={a.nav === 'island'}
          onClick={() => setAppearance({ dock: !a.dock })}
          className="flex items-center gap-3 disabled:opacity-60"
        >
          <span className={`relative h-7 w-12 rounded-full transition-colors ${a.dock || a.nav === 'island' ? 'bg-brand-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-snow shadow transition-all ${a.dock || a.nav === 'island' ? 'left-6' : 'left-1'}`} />
          </span>
          <span className="text-sm font-medium">{a.dock || a.nav === 'island' ? 'Yoqilgan' : "O'chirilgan"}</span>
        </button>
      </Section>

      <Section title="Asosiy rang">
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((c) => (
            <button
              key={c.id}
              onClick={() => setAppearance({ accent: c.id })}
              aria-label={c.label}
              aria-pressed={a.accent === c.id}
              className="group flex flex-col items-center gap-1.5 text-xs text-gray-600"
            >
              <span
                className={`grid h-11 w-11 place-items-center rounded-full text-snow ring-offset-2 ring-offset-gray-100 transition group-hover:scale-110 group-active:scale-95 ${a.accent === c.id ? 'ring-2 ring-gray-800' : ''}`}
                style={{ background: c.color }}
              >
                {a.accent === c.id && <Check size={18} strokeWidth={3} />}
              </span>
              {c.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Rejim">
        <div className="grid max-w-sm grid-cols-2 gap-3">
          {[{ id: false, label: "Yorug'" }, { id: true, label: "Qorong'u" }].map((m) => (
            <button key={String(m.id)} onClick={() => dark !== m.id && toggleTheme()} className={pick(dark === m.id)} aria-pressed={dark === m.id}>
              {dark === m.id && <Tick />}
              <div className={`mb-2 h-10 rounded-md border ${m.id ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`} />
              <div className="text-sm font-semibold">{m.label}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Shrift">
        <div className="grid gap-3 sm:grid-cols-3">
          {FONTS.map((f) => (
            <button key={f.id} onClick={() => setAppearance({ font: f.id })} className={pick(a.font === f.id)} aria-pressed={a.font === f.id}>
              {a.font === f.id && <Tick />}
              <div className="text-2xl font-bold" style={{ fontFamily: f.family }}>Aa</div>
              <div className="text-sm" style={{ fontFamily: f.family }}>Gilam yuvish 12 500</div>
              <div className="mt-1 text-xs text-gray-500">{f.label}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Burchaklar">
        <div className="grid max-w-md grid-cols-3 gap-3">
          {radii.map((r) => (
            <button key={r.id} onClick={() => setAppearance({ radius: r.id })} className={pick(a.radius === r.id)} aria-pressed={a.radius === r.id}>
              {a.radius === r.id && <Tick />}
              <div
                className="mb-2 h-10 border-2 border-brand-600 bg-brand-50"
                style={{ borderRadius: r.id === 'sharp' ? 2 : r.id === 'soft' ? 10 : 20 }}
              />
              <div className="text-sm font-semibold">{r.label}</div>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
