import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, History, MessageCircle, CheckCircle2, ChevronDown, ClipboardList, Droplets, LogOut, Menu, PackageCheck, Receipt, Settings, ShieldCheck, SlidersHorizontal, Truck, UserCog, Users as UsersIcon, Wallet, X, XCircle } from 'lucide-react';
import { useAuth } from '../auth';
import { useAppearance } from '../appearance';
import { BrandMark, useBranding } from '../branding';
import { ChatProvider, UnreadDot, useChatUnread } from '../chat';
import { CallProvider } from '../calls';
import ThemeToggle from './ThemeToggle';
import { Loading } from './ui';

// Order pipeline: the strip under the navbar shows where each order list sits in the flow.
const stages = [
  { to: '/sales/received', label: 'Olingan', full: 'Olingan zakazlar', icon: ClipboardList },
  { to: '/sales/picked-up', label: 'Olindi', full: 'Olib ketildi', icon: Truck },
  { to: '/sales/washed', label: 'Yuvildi', full: "Yuvib bo'lingan", icon: Droplets },
  { to: '/sales/packed', label: 'Upakovka', full: 'Upakovka qilingan', icon: PackageCheck },
  { to: '/sales/completed', label: 'Tayyor', full: 'Tugallangan sotuvlar', icon: CheckCircle2 },
  { to: '/sales/cancelled', label: 'Bekor', full: 'Bekor qilinganlar', icon: XCircle },
];

const top = ({ isActive }: { isActive: boolean }) =>
  `relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;

const drawerLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition active:scale-[0.98] ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100'
  }`;

function Logo() {
  const { name } = useBranding();
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={32} />
      <span className="max-w-[11rem] truncate font-display text-lg font-bold tracking-tight text-gray-900">{name}</span>
    </span>
  );
}

function AdminMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const active = ['/users', '/dictionaries', '/roles', '/activity'].some((p) => pathname.startsWith(p));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        <Settings size={15} /> Boshqaruv <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="anim-menu absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
          <NavLink to="/users" className={drawerLink}><UserCog size={17} />Foydalanuvchilar</NavLink>
          <NavLink to="/dictionaries" className={drawerLink}><BookOpen size={17} />Xizmatlar va turlar</NavLink>
          <NavLink to="/roles" className={drawerLink}><ShieldCheck size={17} />Rollar va huquqlar</NavLink>
          <NavLink to="/activity" className={drawerLink}><History size={17} />Faoliyat jurnali</NavLink>
        </div>
      )}
    </div>
  );
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/** Island layout: the order stages as a floating segmented control with a sliding highlight. */
function StagePills() {
  const { pathname } = useLocation();
  const idx = Math.max(0, stages.findIndex((s) => pathname.startsWith(s.to)));
  const n = stages.length;
  return (
    <nav aria-label="Zakaz bosqichlari" className="relative grid rounded-full border border-gray-200 bg-white/80 p-1 shadow-sm backdrop-blur" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-brand-600 shadow-md shadow-brand-600/30 transition-transform duration-300 ease-[cubic-bezier(0.3,1.2,0.5,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${idx * 100}%)` }}
      />
      {stages.map((s, i) => (
        <NavLink key={s.to} to={s.to} className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-2 py-2 text-sm font-medium transition-colors ${focusRing} ${i === idx ? 'text-snow' : 'text-gray-600 hover:text-gray-900'}`}>
          <s.icon size={16} className="shrink-0" />
          <span className="truncate">{s.full}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function StageStrip({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const idx = Math.max(0, stages.findIndex((s) => pathname.startsWith(s.to)));
  return (
    <div className={className}>
      <div className="mx-auto max-w-7xl px-1 sm:px-6">
      <nav aria-label="Zakaz bosqichlari" className="relative grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={`group flex flex-col items-center justify-center gap-1 px-0.5 py-2.5 text-[10px] font-medium transition-colors lg:flex-row lg:gap-2 lg:px-1 lg:py-3 lg:text-sm ${focusRing} ${
              i === idx ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <s.icon size={16} className={`shrink-0 transition-colors ${i === idx ? 'text-brand-600' : ''}`} />
            <span className="lg:hidden">{s.label}</span>
            <span className="hidden lg:inline">{s.full}</span>
          </NavLink>
        ))}
        <span
          aria-hidden
          className="absolute bottom-0 h-[3px] px-3 transition-transform duration-300 ease-[cubic-bezier(0.3,1.2,0.5,1)] lg:px-6"
          style={{ width: `${100 / stages.length}%`, transform: `translateX(${idx * 100}%)`, left: 0 }}
        >
          <span className="block h-full rounded-full bg-saffron" />
        </span>
      </nav>
      </div>
    </div>
  );
}

function ChatLink({ className = '' }: { className?: string }) {
  const { unread } = useChatUnread();
  return (
    <NavLink to="/chat" title="Chat" aria-label="Chat" className={({ isActive }) => `relative grid h-9 w-9 place-items-center rounded-lg transition active:scale-90 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'} ${className}`}>
      <MessageCircle size={18} />
      <UnreadDot n={unread.total} className="absolute -right-0.5 -top-0.5 ring-2 ring-white" />
    </NavLink>
  );
}

function UserBox({ compact }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const initials = user!.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="ml-auto flex items-center gap-1">
      <ChatLink />
      <ThemeToggle />
      <NavLink to="/settings" title="Sozlamalar" aria-label="Sozlamalar" className={({ isActive }) => `grid h-9 w-9 place-items-center rounded-lg transition active:scale-90 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}>
        <SlidersHorizontal size={18} />
      </NavLink>
      <div className={`ml-1 items-center gap-2 border-l border-gray-200 pl-3 ${compact ? 'hidden xl:flex' : 'hidden sm:flex'}`}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{initials}</span>
        <div className="leading-tight">
          <div className="max-w-[10rem] truncate text-sm font-medium">{user!.fullName}</div>
          <div className="text-xs text-gray-500">{user!.roleName ?? user!.role}</div>
        </div>
      </div>
      <button onClick={logout} title="Chiqish" aria-label="Chiqish" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:scale-90"><LogOut size={18} /></button>
    </div>
  );
}

function TopLinks() {
  const { can, isAdmin } = useAuth();
  const { pathname } = useLocation();
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {can('orders.view') && <NavLink to="/sales/received" className={() => top({ isActive: pathname.startsWith('/sales') })}>Sotuvlar</NavLink>}
      {can('clients.view') && <NavLink to="/clients" className={top}>Mijozlar</NavLink>}
      {can('debtors.view') && <NavLink to="/debtors" className={top}>Qarzdorlar</NavLink>}
      {can('expenses.manage') && <NavLink to="/expenses" className={top}>Xarajatlar</NavLink>}
      {can('reports.view') && <NavLink to="/summary" className={top}>Hisobot</NavLink>}
      {isAdmin && <AdminMenu />}
    </nav>
  );
}

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;
const Group = ({ children }: { children: string }) => (
  <div className="px-3 pb-1 pt-4 text-xs font-semibold text-gray-400">{children}</div>
);

function ChatSideLink() {
  const { unread } = useChatUnread();
  return <NavLink to="/chat" className={sideLink}><MessageCircle size={17} />Chat<UnreadDot n={unread.total} className="ml-auto" /></NavLink>;
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, can, isAdmin } = useAuth();
  return (
    <>
      <nav className="flex flex-col gap-0.5" onClick={onNavigate}>
        {can('orders.view') && <><Group>Sotuvlar</Group>
        {stages.map((s) => <NavLink key={s.to} to={s.to} className={sideLink}><s.icon size={17} className="shrink-0" />{s.full}</NavLink>)}</>}
        {(can('clients.view') || can('debtors.view')) && <Group>Mijozlar</Group>}
        {can('clients.view') && <NavLink to="/clients" className={sideLink}><UsersIcon size={17} />Mijozlar</NavLink>}
        {can('debtors.view') && <NavLink to="/debtors" className={sideLink}><Wallet size={17} />Qarzdorlar</NavLink>}
        {can('expenses.manage') && <><Group>Moliya</Group><NavLink to="/expenses" className={sideLink}><Receipt size={17} />Xarajatlar</NavLink></>}
        {(can('reports.view') || isAdmin) && (
          <>
            <Group>Boshqaruv</Group>
            {can('reports.view') && <NavLink to="/summary" className={sideLink}><BarChart3 size={17} />Hisobot</NavLink>}
            {isAdmin && <NavLink to="/users" className={sideLink}><UserCog size={17} />Foydalanuvchilar</NavLink>}
            {isAdmin && <NavLink to="/roles" className={sideLink}><ShieldCheck size={17} />Rollar va huquqlar</NavLink>}
            {isAdmin && <NavLink to="/activity" className={sideLink}><History size={17} />Faoliyat jurnali</NavLink>}
            {isAdmin && <NavLink to="/dictionaries" className={sideLink}><BookOpen size={17} />Xizmatlar va turlar</NavLink>}
          </>
        )}
        <Group>Tizim</Group>
        <ChatSideLink />
        <NavLink to="/settings" className={sideLink}><SlidersHorizontal size={17} />Sozlamalar</NavLink>
      </nav>
      <div className="mt-auto flex items-center gap-2 border-t border-gray-200 px-1 pb-[env(safe-area-inset-bottom)] pt-3">
        <div className="min-w-0 flex-1 pl-2">
          <div className="truncate text-sm font-medium">{user!.fullName}</div>
          <div className="text-xs text-gray-500">{user!.roleName ?? user!.role}</div>
        </div>
        <ThemeToggle />
        <button onClick={logout} title="Chiqish" aria-label="Chiqish" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 active:scale-90"><LogOut size={16} /></button>
      </div>
    </>
  );
}

function Dock({ onMore }: { onMore: () => void }) {
  const { can } = useAuth();
  const { unread } = useChatUnread();
  const { pathname } = useLocation();
  const items = [
    ...(can('orders.view') ? [{ to: '/sales/received', label: 'Sotuvlar', icon: ClipboardList, active: pathname.startsWith('/sales'), phone: true }] : []),
    ...(can('clients.view') ? [{ to: '/clients', label: 'Mijozlar', icon: UsersIcon, active: pathname.startsWith('/clients'), phone: true }] : []),
    ...(can('debtors.view') ? [{ to: '/debtors', label: 'Qarzdorlar', icon: Wallet, active: pathname.startsWith('/debtors'), phone: true }] : []),
    ...(can('expenses.manage') ? [{ to: '/expenses', label: 'Xarajatlar', icon: Receipt, active: pathname.startsWith('/expenses') }] : []),
    ...(can('reports.view') ? [{ to: '/summary', label: 'Hisobot', icon: BarChart3, active: pathname.startsWith('/summary') }] : []),
    { to: '/chat', label: 'Chat', icon: MessageCircle, active: pathname.startsWith('/chat'), badge: unread.total, phone: true },
  ];
  const cls = (on: boolean) =>
    `group flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-medium transition active:scale-90 lg:min-w-[4.5rem] lg:flex-none lg:flex-row lg:gap-2 lg:px-4 lg:py-2.5 lg:text-sm ${
      on ? 'bg-brand-600 text-snow shadow-md shadow-brand-600/30' : 'text-gray-600 hover:bg-gray-100'
    }`;
  return (
    <nav
      aria-label="Asosiy menyu"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="anim-dock flex w-full max-w-md items-center gap-0.5 rounded-full lg:w-auto lg:max-w-full lg:gap-1 border border-gray-200 bg-white/85 p-1.5 shadow-[0_12px_36px_-10px_rgb(16_39_43/0.45)] backdrop-blur-xl">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={() => `${cls(i.active)} ${'phone' in i ? '' : 'max-lg:hidden'}`}>
            <span className="relative"><i.icon size={19} />{'badge' in i && <UnreadDot n={i.badge as number} className="absolute -right-2 -top-1.5" />}</span>{i.label}
          </NavLink>
        ))}
        <button onClick={onMore} className={cls(false)} aria-label="Boshqa bo'limlar">
          <Menu size={19} /><span>Yana</span>
        </button>
      </div>
    </nav>
  );
}

const titles: [string, string][] = [
  ['/sales/received', 'Olingan zakazlar'], ['/sales/picked-up', 'Olib ketildi'], ['/sales/washed', "Yuvib bo'lingan"], ['/sales/packed', 'Upakovka qilingan'], ['/sales/completed', 'Tugallangan sotuvlar'],
  ['/sales/cancelled', 'Bekor qilinganlar'], ['/clients', 'Mijozlar'], ['/debtors', 'Qarzdorlar'], ['/expenses', 'Xarajatlar'],
  ['/summary', 'Hisobot'], ['/chat', 'Chat'], ['/users', 'Foydalanuvchilar'], ['/dictionaries', 'Xizmatlar va turlar'], ['/roles', 'Rollar va huquqlar'], ['/activity', 'Faoliyat jurnali'], ['/settings', 'Sozlamalar'],
];

export default function Layout() {
  return <ChatProvider><CallProvider><LayoutInner /></CallProvider></ChatProvider>;
}

function LayoutInner() {
  const { nav, dock } = useAppearance();
  const { name } = useBranding();
  const showDock = nav === 'island' || dock;
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const inSales = pathname.startsWith('/sales');

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className={`min-h-screen ${nav === 'sidebar' ? 'lg:flex' : ''}`}>
      {/* Mobile header (all layouts) */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-1 px-2">
          <button onClick={() => setOpen(true)} aria-label="Menyu" className="grid h-10 w-10 place-items-center rounded-lg text-gray-700 hover:bg-gray-100 active:scale-90"><Menu size={22} /></button>
          <NavLink to="/sales/received" className="flex-1"><Logo /></NavLink>
          <ChatLink />
          <ThemeToggle />
        </div>
        {inSales && <StageStrip />}
      </header>

      {/* Desktop: top bar */}
      {nav === 'top' && (
        <header className="sticky top-0 z-30 hidden border-b border-gray-200 bg-white/90 backdrop-blur-md lg:block">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-6">
            <NavLink to="/sales/received" className="mr-8"><Logo /></NavLink>
            <TopLinks />
            <UserBox />
          </div>
          {inSales && <StageStrip />}
        </header>
      )}

      {/* Desktop: floating island */}
      {nav === 'island' && (
        <div className="sticky top-3 z-30 mx-auto hidden w-full max-w-6xl px-6 pt-3 lg:block">
          <header className="flex h-14 items-center gap-2 rounded-full border border-gray-200 bg-white/80 pl-5 pr-3 shadow-[0_10px_30px_-12px_rgb(16_39_43/0.35)] backdrop-blur-xl">
            <NavLink to="/sales/received"><Logo /></NavLink>
            <UserBox compact />
          </header>
        </div>
      )}

      {/* Desktop: sidebar */}
      {nav === 'sidebar' && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white p-3 lg:flex">
          <div className="px-2 py-3"><NavLink to="/sales/received"><Logo /></NavLink></div>
          <SidebarNav />
        </aside>
      )}

      {showDock && <Dock onMore={() => setOpen(true)} />}

      {/* Drawer (mobile menu; "Yana" in island mode on desktop too) */}
      <div onClick={() => setOpen(false)} className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${showDock ? '' : 'lg:hidden'} ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white p-3 shadow-2xl transition-transform duration-300 ease-out ${showDock ? '' : 'lg:hidden'} ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2 py-2">
          <Logo />
          <button onClick={() => setOpen(false)} aria-label="Yopish" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </aside>

      <div className="min-w-0 flex-1">
        {nav === 'sidebar' && (
          <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-6 backdrop-blur-md lg:flex">
            <div className="font-display text-base font-semibold text-gray-900">{titles.find(([p]) => pathname.startsWith(p))?.[1] ?? name}</div>
            <UserBox />
          </header>
        )}
        {nav === 'island' && inSales && (
          <div className="mx-auto mt-5 hidden max-w-6xl px-6 lg:block">
            <StagePills />
          </div>
        )}
        <main key={pathname} className={`anim-page mx-auto w-full p-3 sm:p-6 ${nav === 'island' ? 'max-w-6xl' : 'max-w-7xl'} ${showDock ? 'pb-28 sm:pb-28' : 'pb-[max(1rem,env(safe-area-inset-bottom))]'}`}>
          <Suspense fallback={<Loading />}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  );
}
