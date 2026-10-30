import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Branding } from './types';

export const DEFAULT_LOGIN_TITLE = 'Gilam, adyol va pardalar: qabul qilishdan yetkazishgacha.';
export const DEFAULT_LOGIN_SUBTITLE = 'Zakaz, mijoz, qarz va xarajatlar bir joyda.';
const DEFAULT: Branding = { name: 'BIS CRM', logo: null, loginTitle: null, loginSubtitle: null, loginBackground: null, loginColor: null };
const KEY = 'crm_branding';

const cached = (): Branding => {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULT; }
};

interface Ctx extends Branding { save: (patch: Partial<Branding>) => Promise<void> }
const BrandingCtx = createContext<Ctx>({ ...DEFAULT, save: async () => {} });
export const useBranding = () => useContext(BrandingCtx);

function applyToDocument(b: Branding) {
  document.title = b.name;
  let link = document.querySelector<HTMLLinkElement>('link[rel=icon]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  if (b.logo) link.href = b.logo;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [b, setB] = useState<Branding>(cached);

  const set = useCallback((next: Branding) => {
    setB(next);
    applyToDocument(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    applyToDocument(b);
    api<Branding>('/branding').then(set).catch(() => { /* keep cached/default */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch: Partial<Branding>) => set(await api<Branding>('/branding', { method: 'PUT', body: patch }));

  return <BrandingCtx.Provider value={{ ...b, save }}>{children}</BrandingCtx.Provider>;
}

/** Project logo (uploaded image, or the first letter of the name on a colored tile). */
export function BrandMark({ size = 32, saffron }: { size?: number; saffron?: boolean }) {
  const { name, logo } = useBranding();
  if (logo) return <img src={logo} alt="" width={size} height={size} className="shrink-0 rounded-lg object-contain" style={{ width: size, height: size }} />;
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg font-display font-extrabold shadow-sm ${saffron ? 'bg-saffron text-ink' : 'bg-brand-600 text-snow shadow-brand-600/40'}`} style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {name.trim().charAt(0).toUpperCase() || 'B'}
    </span>
  );
}
