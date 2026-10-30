export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://bis-newcrm-api.fly.dev/api';
const KEY = 'crm_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(API + path, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') {
      setToken(null);
      window.dispatchEvent(new Event('crm-logout'));
    }
    const detail = Array.isArray(json.details) && json.details.length
      ? ' (' + json.details.map((d: { path?: string; message?: string }) => `${d.path ? d.path + ': ' : ''}${d.message ?? ''}`).join('; ') + ')' : '';
    throw new ApiError((json.error ?? 'Xatolik yuz berdi') + detail, res.status);
  }
  return json as T;
}

export const fmtMoney = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + " so'm";

export const todayStr = () => new Date().toLocaleDateString('sv-SE');

const authHeader = (): Record<string, string> => { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

/** Send a file/blob as the raw request body (name and type go in the query string). */
export async function apiUpload<T>(path: string, blob: Blob, name: string): Promise<T> {
  const res = await fetch(`${API}${path}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(blob.type || 'application/octet-stream')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...authHeader() },
    body: blob,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? 'Fayl yuborilmadi', res.status);
  return json as T;
}

/** Download a protected file as a Blob (the Bearer token can't go in an <img>/<audio> src). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(API + path, { headers: authHeader() });
  if (!res.ok) throw new ApiError('Faylni yuklab bo\'lmadi', res.status);
  return res.blob();
}
