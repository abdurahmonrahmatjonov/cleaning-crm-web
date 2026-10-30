import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { Permission, User } from './types';

interface Ctx { user: User | null; loading: boolean; can: (p: Permission) => boolean; isAdmin: boolean; login: (u: string, p: string) => Promise<void>; logout: () => void }
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (getToken()) {
      api<User>('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
    }
    const out = () => setUser(null);
    window.addEventListener('crm-logout', out);
    return () => window.removeEventListener('crm-logout', out);
  }, []);

  const login = async (username: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { username, password } });
    setToken(r.token);
    setUser(r.user);
  };
  const logout = () => { setToken(null); setUser(null); };

  const can = (p: Permission) => !!user?.permissions?.includes(p);
  const isAdmin = user?.role === 'admin';

  return <AuthCtx.Provider value={{ user, loading, can, isAdmin, login, logout }}>{children}</AuthCtx.Provider>;
}
