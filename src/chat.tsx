import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

export interface Unread { global: number; direct: Record<string, number>; total: number }
const EMPTY: Unread = { global: 0, direct: {}, total: 0 };

interface Ctx { unread: Unread; refresh: () => void }
const ChatCtx = createContext<Ctx>({ unread: EMPTY, refresh: () => {} });
export const useChatUnread = () => useContext(ChatCtx);

/** Polls the unread counters for the menu badge (slower while the tab is hidden). */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState<Unread>(EMPTY);
  const refresh = useCallback(() => {
    api<Unread>('/chat/unread').then(setUnread).catch(() => { /* offline or signed out: keep last value */ });
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 8000);
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [refresh]);

  return <ChatCtx.Provider value={{ unread, refresh }}>{children}</ChatCtx.Provider>;
}

export const UnreadDot = ({ n, className = '' }: { n: number; className?: string }) =>
  n > 0 ? (
    <span className={`inline-grid min-w-[1.15rem] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[1.15rem] text-snow ${className}`}>
      {n > 99 ? '99+' : n}
    </span>
  ) : null;
