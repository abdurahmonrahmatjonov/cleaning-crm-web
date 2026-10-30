import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { API, api, getToken } from './api';
import { useAuth } from './auth';

type Media = 'audio' | 'video';
type Phase = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected';
interface Peer { id: number; name: string }
interface Signal { from: Peer & { fullName: string }; callId: string; type: 'offer' | 'answer' | 'ice' | 'hangup' | 'reject' | 'busy'; media?: Media; data?: unknown }

interface Ctx { startCall: (peer: Peer, media: Media) => void; busy: boolean }
const CallCtx = createContext<Ctx>({ startCall: () => {}, busy: false });
export const useCall = () => useContext(CallCtx);

/** A soft two-tone ring generated with WebAudio (no audio asset needed). Returns a stop function. */
function ring(pattern: 'incoming' | 'outgoing') {
  try {
    const ctx = new AudioContext();
    const tick = () => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = pattern === 'incoming' ? 740 : 440;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 1);
    };
    tick();
    const t = setInterval(tick, pattern === 'incoming' ? 1800 : 3000);
    return () => { clearInterval(t); ctx.close().catch(() => {}); };
  } catch { return () => {}; }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
const send = (to: number, callId: string, type: Signal['type'], extra: { media?: Media; data?: unknown } = {}) =>
  api('/chat/call/signal', { method: 'POST', body: { to, callId, type, ...extra } });

/**
 * One-to-one voice/video calls over WebRTC. Signaling goes through the API (server-sent events);
 * the audio/video itself flows directly between the two browsers.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [media, setMedia] = useState<Media>('audio');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState('');

  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const callId = useRef('');
  const pendingOffer = useRef<Signal | null>(null);
  const queuedIce = useRef<RTCIceCandidateInit[]>([]);
  const stopRing = useRef<() => void>(() => {});
  const phaseRef = useRef<Phase>('idle');
  const peerRef = useRef<Peer | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const remoteStream = useRef<MediaStream>(new MediaStream());

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const cleanup = useCallback((message = '') => {
    stopRing.current(); stopRing.current = () => {};
    pc.current?.close(); pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null;
    remoteStream.current = new MediaStream();
    pendingOffer.current = null; queuedIce.current = [];
    callId.current = ''; peerRef.current = null;
    setMuted(false); setCamOff(false); setSecs(0); setPeer(null);
    setP('idle');
    if (message) { setNote(message); setTimeout(() => setNote(''), 3500); }
  }, []);

  const iceServers = async (): Promise<RTCIceServer[]> => {
    try { return (await api<{ iceServers: RTCIceServer[] }>('/chat/ice')).iceServers; }
    catch { return [{ urls: 'stun:stun.l.google.com:19302' }]; }
  };

  const makePc = async (to: Peer) => {
    const conn = new RTCPeerConnection({ iceServers: await iceServers() });
    conn.onicecandidate = (e) => { if (e.candidate) send(to.id, callId.current, 'ice', { data: e.candidate.toJSON() }).catch(() => {}); };
    conn.ontrack = (e) => { e.streams[0]?.getTracks().forEach((t) => remoteStream.current.addTrack(t)); attach(); };
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') { stopRing.current(); stopRing.current = () => {}; setP('connected'); }
      if (conn.connectionState === 'failed') { send(to.id, callId.current, 'hangup').catch(() => {}); cleanup("Aloqa uzildi"); }
    };
    pc.current = conn;
    return conn;
  };

  const getMedia = async (m: Media) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: m === 'video' ? { facingMode: 'user' } : false });
      local.current = s; return s;
    } catch {
      throw new Error(m === 'video' ? "Kamera yoki mikrofonga ruxsat berilmadi" : 'Mikrofonga ruxsat berilmadi');
    }
  };

  const attach = () => {
    if (remoteVideo.current && remoteVideo.current.srcObject !== remoteStream.current) remoteVideo.current.srcObject = remoteStream.current;
    if (remoteAudio.current && remoteAudio.current.srcObject !== remoteStream.current) remoteAudio.current.srcObject = remoteStream.current;
    if (localVideo.current && local.current && localVideo.current.srcObject !== local.current) localVideo.current.srcObject = local.current;
  };
  useEffect(attach, [phase, media]);

  const startCall = useCallback(async (to: Peer, m: Media) => {
    if (phaseRef.current !== 'idle') return;
    setMedia(m); setPeer(to); peerRef.current = to; setP('calling');
    callId.current = uid();
    try {
      const stream = await getMedia(m);
      const conn = await makePc(to);
      stream.getTracks().forEach((t) => conn.addTrack(t, stream));
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      await send(to.id, callId.current, 'offer', { media: m, data: offer });
      stopRing.current = ring('outgoing');
      attach();
    } catch (x) {
      const msg = (x as Error).message;
      cleanup(/offline/i.test(msg) ? `${to.name} hozir onlayn emas` : msg);
    }
  }, [cleanup]); // eslint-disable-line react-hooks/exhaustive-deps

  const accept = async () => {
    const offer = pendingOffer.current; const from = peerRef.current;
    if (!offer || !from) return;
    stopRing.current(); stopRing.current = () => {};
    setP('connecting');
    try {
      const stream = await getMedia(offer.media ?? 'audio');
      const conn = await makePc(from);
      stream.getTracks().forEach((t) => conn.addTrack(t, stream));
      await conn.setRemoteDescription(offer.data as RTCSessionDescriptionInit);
      for (const c of queuedIce.current) await conn.addIceCandidate(c).catch(() => {});
      queuedIce.current = [];
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      await send(from.id, callId.current, 'answer', { data: answer });
      attach();
    } catch (x) {
      send(from.id, callId.current, 'reject').catch(() => {});
      cleanup((x as Error).message);
    }
  };

  const decline = () => {
    if (peerRef.current) send(peerRef.current.id, callId.current, 'reject').catch(() => {});
    cleanup();
  };
  const hangup = () => {
    if (peerRef.current) send(peerRef.current.id, callId.current, 'hangup').catch(() => {});
    cleanup();
  };

  // Incoming signals
  const onSignal = useCallback(async (s: Signal) => {
    const from: Peer = { id: s.from.id, name: s.from.fullName };
    if (s.type === 'offer') {
      if (phaseRef.current !== 'idle') { send(from.id, s.callId, 'busy').catch(() => {}); return; }
      callId.current = s.callId; pendingOffer.current = s; peerRef.current = from;
      setPeer(from); setMedia(s.media ?? 'audio'); setP('incoming');
      stopRing.current = ring('incoming');
      return;
    }
    if (s.callId !== callId.current) return;
    if (s.type === 'answer') {
      await pc.current?.setRemoteDescription(s.data as RTCSessionDescriptionInit);
      for (const c of queuedIce.current) await pc.current?.addIceCandidate(c).catch(() => {});
      queuedIce.current = [];
      setP('connecting');
    } else if (s.type === 'ice') {
      const c = s.data as RTCIceCandidateInit;
      if (pc.current?.remoteDescription) await pc.current.addIceCandidate(c).catch(() => {});
      else queuedIce.current.push(c);
    } else if (s.type === 'reject') cleanup(`${from.name} qo'ng'iroqni rad etdi`);
    else if (s.type === 'busy') cleanup(`${from.name} band`);
    else if (s.type === 'hangup') cleanup(phaseRef.current === 'incoming' ? "Qo'ng'iroq o'tkazib yuborildi" : "Qo'ng'iroq tugadi");
  }, [cleanup]);

  // Event stream (fetch, so the Bearer header can be sent). Reconnects with a short delay.
  useEffect(() => {
    if (!user) return;
    let stop = false; let ctrl: AbortController | null = null;
    const run = async () => {
      while (!stop) {
        ctrl = new AbortController();
        try {
          const res = await fetch(`${API}/chat/events`, { headers: { Authorization: `Bearer ${getToken()}` }, signal: ctrl.signal });
          if (!res.ok || !res.body) throw new Error('stream');
          const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n\n')) !== -1) {
              const block = buf.slice(0, i); buf = buf.slice(i + 2);
              if (block.startsWith('event: signal')) {
                const line = block.split('\n').find((l) => l.startsWith('data: '));
                if (line) onSignal(JSON.parse(line.slice(6)));
              }
            }
          }
        } catch { /* reconnect below */ }
        if (!stop) await new Promise((r) => setTimeout(r, 3000));
      }
    };
    run();
    return () => { stop = true; ctrl?.abort(); };
  }, [user, onSignal]);

  // Timer + leaving the page ends the call cleanly
  useEffect(() => {
    if (phase !== 'connected') return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  // Nobody picked up within 45 seconds
  useEffect(() => {
    if (phase !== 'calling' && phase !== 'incoming') return;
    const t = setTimeout(() => {
      if (peerRef.current) send(peerRef.current.id, callId.current, phase === 'calling' ? 'hangup' : 'reject').catch(() => {});
      cleanup(phase === 'calling' ? 'Javob bermadi' : "Qo'ng'iroq o'tkazib yuborildi");
    }, 45000);
    return () => clearTimeout(t);
  }, [phase, cleanup]);

  const toggleMic = () => { const on = muted; local.current?.getAudioTracks().forEach((t) => (t.enabled = on)); setMuted(!on); };
  const toggleCam = () => { const on = camOff; local.current?.getVideoTracks().forEach((t) => (t.enabled = on)); setCamOff(!on); };

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const label = phase === 'calling' ? 'Qo\'ng\'iroq qilinmoqda…' : phase === 'incoming' ? (media === 'video' ? 'Video qo\'ng\'iroq' : 'Ovozli qo\'ng\'iroq')
    : phase === 'connecting' ? 'Ulanmoqda…' : `${mm}:${ss}`;
  const showVideo = media === 'video' && (phase === 'connected' || phase === 'connecting' || phase === 'calling');

  return (
    <CallCtx.Provider value={{ startCall, busy: phase !== 'idle' }}>
      {children}
      <audio ref={remoteAudio} autoPlay />
      {note && <div role="status" className="anim-menu fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-snow shadow-xl">{note}</div>}
      {phase !== 'idle' && peer && (
        <div className="anim-fade fixed inset-0 z-[90] flex flex-col bg-[#0b1418] text-snow" role="dialog" aria-label="Qo'ng'iroq">
          {showVideo && <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />}
          <div className={`relative flex flex-1 flex-col items-center ${showVideo && phase === 'connected' ? 'justify-start pt-6' : 'justify-center'}`}>
            {!(showVideo && phase === 'connected') && (
              <span className={`mb-5 grid h-28 w-28 place-items-center rounded-full bg-brand-600 text-4xl font-bold ${phase === 'calling' || phase === 'incoming' ? 'animate-pulse' : ''}`}>
                {peer.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            )}
            <div className="rounded-full bg-black/35 px-4 py-1.5 text-center backdrop-blur">
              <div className="font-semibold">{peer.name}</div>
              <div className="text-sm text-snow/75 tabular-nums">{label}</div>
            </div>
          </div>
          {media === 'video' && (
            <video ref={localVideo} autoPlay playsInline muted className={`absolute bottom-28 right-4 h-36 w-24 rounded-xl border-2 border-white/30 bg-black object-cover shadow-xl sm:h-44 sm:w-32 ${phase === 'incoming' ? 'hidden' : ''}`} style={{ transform: 'scaleX(-1)' }} />
          )}
          <div className="relative flex items-center justify-center gap-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
            {phase === 'incoming' ? (
              <>
                <RoundBtn red label="Rad etish" onClick={decline}><PhoneOff size={24} /></RoundBtn>
                <RoundBtn green label="Javob berish" onClick={accept}>{media === 'video' ? <Video size={24} /> : <Phone size={24} />}</RoundBtn>
              </>
            ) : (
              <>
                <RoundBtn label={muted ? 'Mikrofonni yoqish' : "Mikrofonni o'chirish"} active={muted} onClick={toggleMic}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</RoundBtn>
                {media === 'video' && <RoundBtn label={camOff ? 'Kamerani yoqish' : "Kamerani o'chirish"} active={camOff} onClick={toggleCam}>{camOff ? <VideoOff size={22} /> : <Video size={22} />}</RoundBtn>}
                <RoundBtn red label="Tugatish" onClick={hangup}><PhoneOff size={24} /></RoundBtn>
              </>
            )}
          </div>
        </div>
      )}
    </CallCtx.Provider>
  );
}

function RoundBtn({ children, label, onClick, red, green, active }: { children: ReactNode; label: string; onClick: () => void; red?: boolean; green?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={`grid h-14 w-14 place-items-center rounded-full text-snow shadow-lg transition active:scale-90 ${red ? 'bg-red-600 hover:bg-red-500' : green ? 'bg-green-600 hover:bg-green-500' : active ? 'bg-snow text-gray-900' : 'bg-white/15 hover:bg-white/25'}`}>
      {children}
    </button>
  );
}
