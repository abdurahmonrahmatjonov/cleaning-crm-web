import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, Download, FileText, Globe2, Mic, Paperclip, Phone, Search, SendHorizontal, Square, Trash2, Video } from 'lucide-react';
import { api, apiBlob, apiUpload } from '../api';
import { useCall } from '../calls';
import { useAuth } from '../auth';
import { UnreadDot, useChatUnread } from '../chat';

interface FileInfo { name: string; mime: string; size: number; kind: 'image' | 'audio' | 'file' }
interface Msg { id: number; senderId: number; senderName: string; recipientId: number | null; body: string; createdAt: string; file: FileInfo | null }
interface Person { id: number; fullName: string; roleName: string; unread: number; last: { body: string; createdAt: string; fileName?: string; fileMime?: string } | null }
const MAX_BYTES = 15 * 1024 * 1024;
const preview = (l: Person['last']) => !l ? '' : l.body || (l.fileMime?.startsWith('audio/') ? '🎤 Ovozli xabar' : l.fileMime?.startsWith('image/') ? '🖼 Rasm' : `📎 ${l.fileName}`);
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
type Peer = 'global' | number;

const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const hhmm = (s: string) => s.slice(11, 16);
const dayLabel = (d: string) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const yest = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE');
  return d === today ? 'Bugun' : d === yest ? 'Kecha' : d;
};

export default function Chat() {
  const [peer, setPeer] = useState<Peer>('global');
  const [mobileThread, setMobileThread] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState('');
  const { unread, refresh } = useChatUnread();

  const loadPeople = useCallback(() => {
    api<{ data: Person[] }>('/chat/users').then((r) => setPeople(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    loadPeople();
    const t = setInterval(() => { if (!document.hidden) loadPeople(); }, 6000);
    return () => clearInterval(t);
  }, [loadPeople]);

  const shown = people
    .filter((p) => p.fullName.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? '') || a.fullName.localeCompare(b.fullName));
  const current = peer === 'global' ? null : people.find((p) => p.id === peer) ?? null;
  const open = (p: Peer) => { setPeer(p); setMobileThread(true); };

  return (
    <div className="card grid h-[calc(100dvh-9.5rem)] min-h-[28rem] overflow-hidden lg:h-[calc(100dvh-8rem)] lg:grid-cols-[320px_1fr]">
      {/* Conversations */}
      <aside className={`flex min-h-0 flex-col border-gray-200 lg:border-r ${mobileThread ? 'hidden lg:flex' : 'flex'}`}>
        <div className="border-b border-gray-100 p-3">
          <h1 className="mb-2 px-1 text-xl font-bold">Chat</h1>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input !h-10 !pl-9" placeholder="Xodim qidirish…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <Row active={peer === 'global'} onClick={() => open('global')} unread={unread.global}
            avatar={<span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-snow"><Globe2 size={19} /></span>}
            title="Umumiy chat" sub="Barcha xodimlar" />
          <div className="px-3 pb-1 pt-3 text-xs font-semibold text-gray-400">Shaxsiy xabarlar</div>
          {shown.map((p) => (
            <Row key={p.id} active={peer === p.id} onClick={() => open(p.id)} unread={p.unread}
              avatar={<span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials(p.fullName)}</span>}
              title={p.fullName} sub={preview(p.last) || p.roleName} time={p.last ? hhmm(p.last.createdAt) : ''} />
          ))}
          {shown.length === 0 && <div className="px-3 py-6 text-center text-sm text-gray-400">Xodim topilmadi</div>}
        </div>
      </aside>

      {/* Thread */}
      <section className={`min-h-0 flex-col ${mobileThread ? 'flex' : 'hidden lg:flex'}`}>
        <Thread key={String(peer)} peer={peer} title={peer === 'global' ? 'Umumiy chat' : current?.fullName ?? 'Xodim'}
          sub={peer === 'global' ? 'Hamma xodimlar ko\'radi' : current?.roleName ?? ''}
          peerId={peer === 'global' ? null : peer} onBack={() => setMobileThread(false)} onActivity={() => { loadPeople(); refresh(); }} />
      </section>
    </div>
  );
}

function Row({ avatar, title, sub, time, unread, active, onClick }: {
  avatar: React.ReactNode; title: string; sub: string; time?: string; unread: number; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99] ${active ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${unread ? 'font-bold' : 'font-medium'}`}>{title}</span>
          {time && <span className="shrink-0 text-[11px] text-gray-400">{time}</span>}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${unread ? 'text-gray-700' : 'text-gray-500'}`}>{sub}</span>
          <UnreadDot n={unread} />
        </span>
      </span>
    </button>
  );
}

function Thread({ peer, peerId, title, sub, onBack, onActivity }: {
  peer: Peer; peerId: number | null; title: string; sub: string; onBack: () => void; onActivity: () => void;
}) {
  const { user } = useAuth();
  const { startCall, busy: inCall } = useCall();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // keep scrolled to the newest message unless the user scrolled up
  const path = peer === 'global' ? '/chat/global' : `/chat/with/${peer}`;
  const readKey = peer === 'global' ? 'global' : String(peer);

  const markRead = useCallback((upTo: number) => {
    if (!upTo || document.hidden) return;
    api(`/chat/read/${readKey}`, { method: 'PUT', body: { upTo } }).then(onActivity).catch(() => {});
  }, [readKey, onActivity]);

  const lastId = useRef(0);
  const pull = useCallback(async (first: boolean) => {
    try {
      const r = await api<{ data: Msg[] }>(first ? path : `${path}?after=${lastId.current}`);
      if (first) setLoaded(true);
      if (!r.data.length) return;
      lastId.current = r.data[r.data.length - 1].id;
      setMsgs((m) => (first ? r.data : [...m, ...r.data.filter((x) => !m.some((y) => y.id === x.id))]));
      markRead(lastId.current);
    } catch (x) { if (first) { setErr((x as Error).message); setLoaded(true); } }
  }, [path, markRead]);

  useEffect(() => {
    pull(true);
    const t = setInterval(() => { if (!document.hidden) pull(false); }, 3000);
    return () => clearInterval(t);
  }, [pull]);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, loaded]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setErr('');
    try {
      const m = await api<Msg>(path, { method: 'POST', body: { body } });
      setText('');
      stick.current = true;
      lastId.current = Math.max(lastId.current, m.id);
      setMsgs((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
      onActivity();
    } catch (x) { setErr((x as Error).message); } finally { setSending(false); }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const fileInput = useRef<HTMLInputElement>(null);
  const [rec, setRec] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval>>();

  const sendBlob = async (blob: Blob, name: string) => {
    if (blob.size > MAX_BYTES) return setErr(`Fayl juda katta (eng ko'pi ${fmtSize(MAX_BYTES)})`);
    setSending(true); setErr('');
    try {
      const m = await apiUpload<Msg>(`${path}/file`, blob, name);
      stick.current = true;
      lastId.current = Math.max(lastId.current, m.id);
      setMsgs((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
      onActivity();
    } catch (x) { setErr((x as Error).message); } finally { setSending(false); }
  };

  const startRec = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      recorder.current = r;
      r.start();
      setRec(true); setRecSecs(0);
      recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch { setErr('Mikrofonga ruxsat berilmadi'); }
  };
  const stopRec = (sendIt: boolean) => {
    const r = recorder.current; if (!r) return;
    clearInterval(recTimer.current);
    r.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop());
      const type = r.mimeType || 'audio/webm';
      if (sendIt && chunks.current.length) sendBlob(new Blob(chunks.current, { type }), `voice.${type.includes('mp4') ? 'm4a' : 'webm'}`);
    };
    r.stop(); recorder.current = null; setRec(false);
  };
  useEffect(() => () => { clearInterval(recTimer.current); recorder.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  let day = '';
  return (
    <>
      <header className="flex items-center gap-3 border-b border-gray-100 px-3 py-3">
        <button onClick={onBack} aria-label="Orqaga" className="grid h-9 w-9 place-items-center rounded-full text-gray-600 hover:bg-gray-100 lg:hidden"><ArrowLeft size={19} /></button>
        <div className="min-w-0">
          <div className="truncate font-semibold">{title}</div>
          <div className="truncate text-xs text-gray-500">{sub}</div>
        </div>
        {peerId !== null && (
          <div className="ml-auto flex gap-1">
            <button disabled={inCall} onClick={() => startCall({ id: peerId, name: title }, 'audio')} aria-label="Ovozli qo'ng'iroq" title="Ovozli qo'ng'iroq" className="grid h-10 w-10 place-items-center rounded-full text-gray-600 transition hover:bg-gray-100 active:scale-90 disabled:opacity-40"><Phone size={19} /></button>
            <button disabled={inCall} onClick={() => startCall({ id: peerId, name: title }, 'video')} aria-label="Video qo'ng'iroq" title="Video qo'ng'iroq" className="grid h-10 w-10 place-items-center rounded-full text-gray-600 transition hover:bg-gray-100 active:scale-90 disabled:opacity-40"><Video size={19} /></button>
          </div>
        )}
      </header>

      <div ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-gray-50 px-3 py-4 sm:px-5">
        {!loaded && <div className="py-10 text-center text-sm text-gray-400">Yuklanmoqda…</div>}
        {loaded && msgs.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">{peer === 'global' ? "Hali xabar yo'q. Birinchi bo'lib yozing." : 'Suhbatni boshlang.'}</div>
        )}
        {msgs.map((m, i) => {
          const mine = m.senderId === user!.id;
          const d = m.createdAt.slice(0, 10);
          const sep = d !== day ? ((day = d), true) : false;
          const showName = peer === 'global' && !mine && msgs[i - 1]?.senderId !== m.senderId;
          return (
            <div key={m.id}>
              {sep && <div className="my-3 text-center text-[11px] font-medium text-gray-400">{dayLabel(d)}</div>}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${mine ? 'rounded-br-md bg-brand-600 text-snow' : 'rounded-bl-md bg-white text-gray-800'}`}>
                  {showName && <div className="mb-0.5 text-xs font-semibold text-brand-600">{m.senderName}</div>}
                  {m.file && <Attachment m={m} mine={mine} />}
                  {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                  <div className={`mt-0.5 text-right text-[10px] ${mine ? 'text-snow/70' : 'text-gray-400'}`}>{hhmm(m.createdAt)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="border-t border-gray-100 p-3">
        {err && <div className="mb-2 text-xs text-red-600">{err}</div>}
        {rec ? (
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="flex-1 text-sm tabular-nums">Yozilmoqda… {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}</span>
            <button type="button" onClick={() => stopRec(false)} aria-label="Bekor qilish" className="grid h-11 w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100"><Trash2 size={19} /></button>
            <button type="button" onClick={() => stopRec(true)} aria-label="Yuborish" className="btn-primary !h-11 !w-11 !p-0"><SendHorizontal size={18} /></button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            <input ref={fileInput} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendBlob(f, f.name); }} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={sending} aria-label="Fayl biriktirish" title="Fayl biriktirish" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 active:scale-90"><Paperclip size={20} /></button>
            <textarea className="input !h-auto max-h-32 min-h-11 resize-none py-2.5" rows={1} maxLength={2000} placeholder="Xabar yozing…"
              value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} aria-label="Xabar" />
            {text.trim() ? (
              <button className="btn-primary !h-11 !w-11 shrink-0 !p-0" disabled={sending} aria-label="Yuborish"><SendHorizontal size={18} /></button>
            ) : (
              <button type="button" onClick={startRec} disabled={sending} aria-label="Ovozli xabar" title="Ovozli xabar" className="btn-primary !h-11 !w-11 shrink-0 !p-0"><Mic size={19} /></button>
            )}
          </div>
        )}
      </form>
    </>
  );
}

/** Image / voice message / file. Protected, so it's fetched with the token and shown from a blob URL. */
function Attachment({ m, mine }: { m: Msg; mine: boolean }) {
  const f = m.file!;
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (f.kind === 'file') return;
    let revoked = ''; let dead = false;
    apiBlob(`/chat/files/${m.id}`)
      .then((b) => { if (!dead) { revoked = URL.createObjectURL(b); setUrl(revoked); } })
      .catch(() => setFailed(true));
    return () => { dead = true; if (revoked) URL.revokeObjectURL(revoked); };
  }, [m.id, f.kind]);

  const download = async () => {
    try {
      const u = URL.createObjectURL(await apiBlob(`/chat/files/${m.id}`));
      const a = document.createElement('a'); a.href = u; a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch { setFailed(true); }
  };

  if (failed) return <div className="text-xs opacity-70">Faylni yuklab bo'lmadi</div>;
  if (f.kind === 'image') {
    return url
      ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={f.name} className="mb-1 max-h-64 max-w-full rounded-xl object-cover" /></a>
      : <div className="mb-1 h-32 w-48 animate-pulse rounded-xl bg-black/10" />;
  }
  if (f.kind === 'audio') {
    return url
      ? <audio src={url} controls preload="metadata" className="mb-1 h-10 w-56 max-w-full" />
      : <div className="mb-1 h-10 w-56 animate-pulse rounded-full bg-black/10" />;
  }
  return (
    <button type="button" onClick={download} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2 text-left ${mine ? 'bg-white/15' : 'bg-gray-100'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${mine ? 'bg-white/20' : 'bg-white text-brand-600'}`}><FileText size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{f.name}</span>
        <span className="block text-xs opacity-70">{fmtSize(f.size)}</span>
      </span>
      <Download size={17} className="shrink-0 opacity-70" />
    </button>
  );
}
