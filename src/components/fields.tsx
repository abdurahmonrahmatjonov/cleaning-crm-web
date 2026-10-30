import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { formatNumber, maskPhone, normalizePhone, parseNumber } from '../format';

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'>;

/** Phone field. `value` is canonical "+998XXXXXXXXX"; the user sees "+998 90 123 45 67". */
export function PhoneInput({ value, onChange, ...rest }: Base & { value: string; onChange: (v: string) => void }) {
  return (
    <input
      {...rest}
      className={`input ${rest.className ?? ''}`}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+998 90 123 45 67"
      value={maskPhone(value || '+998')}
      onChange={(e) => onChange(normalizePhone(e.target.value))}
      pattern="\+998 \d{2} \d{3} \d{2} \d{2}"
      title="+998 XX XXX XX XX"
      onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("Telefon raqamni to'liq kiriting")}
      onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
    />
  );
}

/**
 * Number field with thousands separators ("1 500 000"). `value` is the raw numeric string
 * ("1500000"), so existing `+value` / Number(value) conversions keep working.
 */
export function NumberInput({ value, onChange, min, max, decimal, ...rest }: Base & {
  value: string; onChange: (v: string) => void; min?: number; max?: number; decimal?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const n = Number(value);
    let msg = '';
    if (value !== '' && Number.isFinite(n)) {
      if (min !== undefined && n < min) msg = `Eng kami ${formatNumber(String(min))}`;
      else if (max !== undefined && n > max) msg = `Eng ko'pi ${formatNumber(String(max))}`;
    }
    ref.current?.setCustomValidity(msg);
  }, [value, min, max]);
  return (
    <input
      {...rest}
      ref={ref}
      className={`input tabular-nums ${rest.className ?? ''}`}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={formatNumber(value)}
      onChange={(e) => onChange(parseNumber(e.target.value, !!decimal))}
    />
  );
}

export interface Option { value: string; label: string }

/** Searchable select (combobox). Rendered in a portal so modals never clip the list. */
export function Select({ value, onChange, options, placeholder = 'Tanlang…', required, disabled, className = '' }: {
  value: string; onChange: (v: string) => void; options: Option[];
  placeholder?: string; required?: boolean; disabled?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const current = options.find((o) => o.value === value);

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 240 && above > below;
    setPos({ left: r.left, width: r.width, maxH: Math.min(320, up ? above : below),
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    const rePlace = (e: Event) => { if (!list.current?.contains(e.target as Node)) place(); };
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', rePlace, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', rePlace, true);
    };
  }, [open]);
  useEffect(() => { setHi(0); }, [q, open]);
  useEffect(() => { list.current?.querySelector('[data-hi="true"]')?.scrollIntoView({ block: 'nearest' }); }, [hi, open]);

  const choose = (o: Option) => { onChange(o.value); setOpen(false); setQ(''); btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[hi]) choose(shown[hi]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus(); }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); } }}
        className={`input flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${current ? '' : 'text-gray-400'}`}>{current ? current.label : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* Keeps native "required" validation working */}
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => {}} className="pointer-events-none -ml-px h-0 w-0 opacity-0" onFocus={() => btn.current?.focus()} />}
      {open && pos && createPortal(
        <div
          ref={list}
          id={id}
          role="listbox"
          onKeyDown={onKey}
          className="anim-menu fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
        >
          {options.length > 6 && (
            <div className="relative border-b border-gray-100 p-2">
              <Search size={15} className="pointer-events-none absolute left-4.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Qidirish…" className="input !h-9 !pl-9" />
            </div>
          )}
          {options.length <= 6 && <input autoFocus aria-label="Qidirish" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} className="sr-only" />}
          <div className="overflow-y-auto p-1">
            {shown.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">Topilmadi</div>}
            {shown.map((o, i) => (
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                data-hi={i === hi}
                key={o.value}
                onMouseEnter={() => setHi(i)}
                onClick={() => choose(o)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${i === hi ? 'bg-brand-50 text-brand-700' : 'text-gray-700'}`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={15} className="shrink-0 text-brand-600" />}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
