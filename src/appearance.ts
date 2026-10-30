import { useSyncExternalStore } from 'react';

export type Nav = 'top' | 'sidebar' | 'island';
export type Radius = 'sharp' | 'soft' | 'round';
export interface Appearance { accent: string; font: string; nav: Nav; radius: Radius; dock: boolean }

export const ACCENTS = [
  { id: 'teal', label: 'Suv', color: '#0f8b8d' },
  { id: 'blue', label: "Ko'k", color: '#2563eb' },
  { id: 'violet', label: 'Binafsha', color: '#7c3aed' },
  { id: 'rose', label: 'Atirgul', color: '#e11d48' },
  { id: 'orange', label: "To'q sariq", color: '#ea580c' },
  { id: 'emerald', label: 'Yashil', color: '#059669' },
  { id: 'slate', label: 'Grafit', color: '#334155' },
];
export const FONTS = [
  { id: 'onest', label: 'Onest', family: "'Onest', system-ui, sans-serif" },
  { id: 'inter', label: 'Inter', family: "'Inter', system-ui, sans-serif" },
  { id: 'manrope', label: 'Manrope', family: "'Manrope', system-ui, sans-serif" },
  { id: 'jakarta', label: 'Plus Jakarta', family: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: 'system', label: 'Tizim', family: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif', label: 'Serif', family: "Georgia, 'Times New Roman', serif" },
];

const KEY = 'crm_appearance';
const DEFAULT: Appearance = { accent: 'teal', font: 'onest', nav: 'top', radius: 'soft', dock: true };

function read(): Appearance {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      accent: ACCENTS.some((a) => a.id === v.accent) ? v.accent : DEFAULT.accent,
      font: FONTS.some((f) => f.id === v.font) ? v.font : DEFAULT.font,
      nav: ['top', 'sidebar', 'island'].includes(v.nav) ? v.nav : DEFAULT.nav,
      radius: ['sharp', 'soft', 'round'].includes(v.radius) ? v.radius : DEFAULT.radius,
      dock: typeof v.dock === 'boolean' ? v.dock : DEFAULT.dock,
    };
  } catch { return DEFAULT; }
}

let state = read();
const subs = new Set<() => void>();

function apply() {
  const el = document.documentElement;
  el.dataset.accent = state.accent;
  el.dataset.font = state.font;
  el.dataset.radius = state.radius;
}
apply();

export function setAppearance(patch: Partial<Appearance>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  apply();
  subs.forEach((f) => f());
}
export const resetAppearance = () => setAppearance(DEFAULT);

export const useAppearance = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);
