import { useSyncExternalStore } from 'react';

type Mode = 'light' | 'dark';
const KEY = 'crm_theme';
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const stored = (): Mode | null => {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; }
};

let mode: Mode = stored() ?? (mq.matches ? 'dark' : 'light');
const subs = new Set<() => void>();

function apply() {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', mode === 'dark' ? '#0c161b' : '#eef3f3');
}
const emit = () => subs.forEach((f) => f());
apply();

mq.addEventListener('change', (e) => {
  if (stored()) return;
  mode = e.matches ? 'dark' : 'light';
  apply(); emit();
});

export function toggleTheme() {
  mode = mode === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable */ }
  apply(); emit();
}

export const useTheme = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => mode);
