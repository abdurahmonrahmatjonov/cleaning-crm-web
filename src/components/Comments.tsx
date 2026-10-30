import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, SendHorizontal, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';

export type CommentTarget = 'order' | 'client' | 'expense';
interface Comment { id: number; userId: number; userName: string; body: string; createdAt: string }

/** Notes on a record: shows who wrote what and when. Authors can delete their own, admins any. */
export default function Comments({ entity, entityId, onChange, bare }: { entity: CommentTarget; entityId: number; onChange?: () => void; bare?: boolean }) {
  const { user, isAdmin } = useAuth();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<{ data: Comment[] }>(`/comments?entity=${entity}&entityId=${entityId}`)
      .then((r) => setList(r.data)).catch((x) => { setErr((x as Error).message); setList([]); });
  }, [entity, entityId]);
  useEffect(load, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr('');
    try {
      const c = await api<Comment>('/comments', { method: 'POST', body: { entity, entityId, body } });
      setList((l) => [...(l ?? []), c]);
      setText('');
      onChange?.();
      setTimeout(() => end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const remove = async (c: Comment) => {
    if (!window.confirm("Izohni o'chirasizmi?")) return;
    try { await api(`/comments/${c.id}`, { method: 'DELETE' }); setList((l) => (l ?? []).filter((x) => x.id !== c.id)); onChange?.(); }
    catch (x) { setErr((x as Error).message); }
  };

  return (
    <div className={bare ? '' : 'mt-5 border-t border-gray-100 pt-4'}>
      <h3 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${bare ? 'sr-only' : ''}`}><MessageSquare size={15} /> Izohlar{list && list.length > 0 && <span className="text-gray-400">({list.length})</span>}</h3>
      {list === null ? <div className="text-sm text-gray-400">Yuklanmoqda…</div> : list.length === 0 ? (
        <div className="mb-3 text-sm text-gray-400">Hali izoh yo'q</div>
      ) : (
        <ul className="mb-3 space-y-2">
          {list.map((c) => (
            <li key={c.id} className="group rounded-xl bg-gray-50 px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{c.userName}</span>
                <span className="flex items-center gap-2 text-xs tabular-nums text-gray-400">
                  {c.createdAt.slice(0, 16)}
                  {(c.userId === user!.id || isAdmin) && (
                    <button type="button" onClick={() => remove(c)} aria-label="Izohni o'chirish" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                  )}
                </span>
              </div>
              <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-700">{c.body}</div>
            </li>
          ))}
        </ul>
      )}
      <div ref={end} />
      {err && <div className="mb-2 text-xs text-red-600">{err}</div>}
      <form onSubmit={add} className="flex items-end gap-2">
        <textarea
          className="input !h-auto max-h-32 min-h-11 resize-none py-2.5" rows={1} maxLength={1000} placeholder="Izoh yozing…"
          value={text} onChange={(e) => setText(e.target.value)} aria-label="Izoh"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(e); } }}
        />
        <button className="btn-primary !h-11 !w-11 shrink-0 !p-0" disabled={!text.trim() || busy} aria-label="Izoh qo'shish"><SendHorizontal size={18} /></button>
      </form>
    </div>
  );
}

/** Comment counts for the rows of a list ({ id: count }); refetches when the ids change. */
export function useCommentCounts(entity: CommentTarget, ids: (number | string)[], refresh?: unknown) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = ids.join(',');
  useEffect(() => {
    if (!key) { setCounts({}); return; }
    api<{ data: Record<string, number> }>(`/comments/counts?entity=${entity}&ids=${key}`).then((r) => setCounts(r.data)).catch(() => setCounts({}));
  }, [entity, key, refresh]);
  return counts;
}

export const CommentBadge = ({ n }: { n?: number }) =>
  n ? <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700" title="Izohlar"><MessageSquare size={11} />{n}</span> : null;
