import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ClipboardList, FileText, LogOut, PlusCircle } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { BrandMark, useBranding } from '../../branding';
import ThemeToggle from '../../components/ThemeToggle';
import type { PartnerMe } from '../../types';
import PartnerOrders from './PartnerOrders';
import PartnerNewOrder from './PartnerNewOrder';
import PartnerStatement from './PartnerStatement';
import { fmtMoneyExact as money } from '../../format';

const tabs = [
  { to: '/', label: 'Buyurtmalar', icon: ClipboardList, end: true },
  { to: '/new', label: 'Yangi buyurtma', icon: PlusCircle, end: false },
  { to: '/statement', label: 'Hisobot', icon: FileText, end: false },
];

export default function PartnerApp() {
  const { user, logout } = useAuth();
  const { name } = useBranding();
  const [me, setMe] = useState<PartnerMe | null>(null);
  const [tick, setTick] = useState(0);

  const { pathname } = useLocation();

  useEffect(() => {
    let alive = true;
    api<PartnerMe>('/partner/me').then((r) => { if (alive) setMe(r); }).catch(() => {});
    return () => { alive = false; };
  }, [tick, pathname === '/new']);
  const refresh = () => setTick((t) => t + 1);

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3 sm:px-6">
          <BrandMark size={30} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-display text-base font-bold text-gray-900">{name}</div>
            <div className="truncate text-xs text-gray-500">{me?.client.name ?? user?.fullName}</div>
          </div>
          <nav className="mr-2 hidden gap-1 sm:flex">
            {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={link}>{t.label}</NavLink>)}
          </nav>
          <ThemeToggle />
          <button onClick={logout} aria-label="Chiqish" title="Chiqish" className="grid h-10 w-10 place-items-center rounded-md text-gray-600 hover:bg-gray-100 active:scale-90"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="anim-page mx-auto w-full max-w-3xl space-y-3 p-3 pb-28 sm:p-6 sm:pb-8">
        {me && (
          <div className="card flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm">
            <span>Qarz: <b className={me.debt > 0 ? 'text-red-600' : ''}>{money(me.debt)}</b></span>
            <span>Jarayonda: <b>{me.inProgressOrders}</b></span>
            <span>Ochiq buyurtmalar: <b>{me.receivedOrders}/{me.orderCap}</b></span>
          </div>
        )}
        <Routes>
          <Route path="/" element={<PartnerOrders onChanged={refresh} />} />
          <Route path="/new" element={<PartnerNewOrder me={me} onCreated={refresh} />} />
          <Route path="/statement" element={<PartnerStatement />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-3">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-brand-700' : 'text-gray-500'}`}>
              <Icon size={20} />{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
