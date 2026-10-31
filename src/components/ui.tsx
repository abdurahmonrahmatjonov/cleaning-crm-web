import { ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="anim-fade fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`anim-modal flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Yopish" className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 active:scale-90"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </div>
    </div>
  );
}

/** Underline tabs for modal content. `badge` shows a small count next to the label. */
export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 border-b border-gray-200">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:bg-gray-50 ${value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
          {t.label}
          {!!t.badge && <span className="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div><label className="label">{label}</label>{children}</div>
);

export const ErrorBox = ({ msg }: { msg: string }) =>
  msg ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div> : null;

const tone: Record<string, [string, string]> = {
  'Zakaz Qabul qilindi': ['bg-amber-100 text-amber-800', 'bg-amber-500'],
  'Olib Ketildi': ['bg-blue-100 text-blue-800', 'bg-blue-500'],
  "Yuvib bo'lingan": ['bg-cyan-100 text-cyan-800', 'bg-cyan-500'],
  'Upakovka qilingan': ['bg-violet-100 text-violet-800', 'bg-violet-500'],
  'Yetkazib berildi': ['bg-green-100 text-green-800', 'bg-green-500'],
  'Bekor qilindi': ['bg-red-100 text-red-700', 'bg-red-500'],
};
export const SaygakBadge = () => <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Saygak</span>;
/** `partner`: a saygak order shows 'Topshirildi' instead of 'Yetkazib berildi' (status value is unchanged). */
export const StatusBadge = ({ s, partner }: { s: string; partner?: boolean }) => {
  const [cls, dot] = tone[s] ?? ['bg-gray-100 text-gray-600', 'bg-gray-400'];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{partner && s === 'Yetkazib berildi' ? 'Topshirildi' : s}
    </span>
  );
};

export const Empty = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 text-gray-400"><Inbox size={26} /></span>
    <span className="text-sm text-gray-500">{text}</span>
  </div>
);

export function Pager({ page, limit, total, onChange }: { page: number; limit: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
      <span>{total} ta yozuv</span>
      <div className="flex items-center gap-2">
        <button className="btn-ghost !h-9 !px-3" aria-label="Oldingi" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button>
        <span className="min-w-14 text-center tabular-nums">{page} / {pages}</span>
        <button className="btn-ghost !h-9 !px-3" aria-label="Keyingi" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Yuklanmoqda">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
      {slow && <p className="text-center text-xs text-gray-400">Server uyg'onmoqda, biroz kuting…</p>}
    </div>
  );
}

/** Accessible on/off switch. */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}>
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}
