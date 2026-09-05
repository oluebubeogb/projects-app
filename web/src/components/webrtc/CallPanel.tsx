"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  PhoneIncoming,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  kind?: "dm" | "forum" | "project";
  contextId?: string;
  className?: string;
  compact?: boolean;
};

type RingtoneId = "chime" | "pulse" | "soft";

const RINGTONE_LABELS: Record<RingtoneId, string> = {
  chime: "Chime",
  pulse: "Pulse",
  soft: "Soft wave",
};

const RING_TIMEOUT_MS = 60_000;

function createRingtonePlayer(id: RingtoneId) {
  let ctx: AudioContext | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  function tone(freqs: number[], duration: number) {
    if (!ctx || stopped) return;
    const now = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = id === "pulse" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.1, now + i * 0.05 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      o.connect(g);
      g.connect(ctx!.destination);
      o.start(now + i * 0.05);
      o.stop(now + duration + 0.05);
    });
  }

  function playOnce() {
    if (stopped) return;
    if (id === "chime") tone([880, 1174, 1480], 0.45);
    else if (id === "pulse") tone([523, 659], 0.28);
    else tone([392, 494, 587], 0.55);
  }

  return {
    start() {
      stopped = false;
      try {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        playOnce();
        interval = setInterval(playOnce, id === "pulse" ? 900 : 1600);
      } catch {}
    },
    stop() {
      stopped = true;
      if (interval) clearInterval(interval);
      interval = null;
      try {
        ctx?.close();
      } catch {}
      ctx = null;
    },
  };
}

function playNotificationTone() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

export function CallPanel({ kind = "dm", contextId, className, compact = false }: Props) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "ringing" | "connecting" | "live" | "error">("idle");
  const [incoming, setIncoming] = useState<{ id: string; hostId: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [ringtone, setRingtone] = useState<RingtoneId>(() => {
    if (typeof window === "undefined") return "chime";
    return (localStorage.getItem("call-ringtone") as RingtoneId) || "chime";
  });
  const [showRingtonePicker, setShowRingtonePicker] = useState(false);
  const [ringSecondsLeft, setRingSecondsLeft] = useState(60);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sinceRef = useRef(0);
  const isHostRef = useRef(false);
  const ringtoneRef = useRef<ReturnType<typeof createRingtonePlayer> | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const statusRef = useRef(status);
  const handledRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (ringTickRef.current) {
      clearInterval(ringTickRef.current);
      ringTickRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    stopRingtone();
  }, [stopRingtone]);

  useEffect(() => () => {
    cleanup();
    if (roomPollRef.current) clearInterval(roomPollRef.current);
  }, [cleanup]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  async function ensurePc() {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pc.onicecandidate = (e) => {
      if (e.candidate && roomIdRef.current) {
        fetch(`/api/calls/${roomIdRef.current}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "ice", payload: e.candidate }),
        }).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      // Attach audio
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
      // Attach video if present
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        // soft recovery — keep UI, user can end
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function getLocalStream(video: boolean) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: video ? { width: 640, height: 480 } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }

  function startPolling(rid: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    sinceRef.current = Date.now() - 2000;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls/${rid}/signal?since=${sinceRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        sinceRef.current = data.serverTime || Date.now();
        for (const s of data.signals || []) {
          await handleSignal(s);
        }
      } catch {}
    }, 800);
  }

  async function handleSignal(s: { from: string; type: string; payload: unknown }) {
    const pc = await ensurePc();
    try {
      if (s.type === "offer" && !isHostRef.current) {
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        // ensure local tracks are on the pc before answering
        if (localStreamRef.current) {
          for (const track of localStreamRef.current.getTracks()) {
            const already = pc.getSenders().some((snd) => snd.track?.id === track.id);
            if (!already) pc.addTrack(track, localStreamRef.current);
          }
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await fetch(`/api/calls/${roomIdRef.current}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "answer", payload: answer }),
        });
        setStatus("live");
        stopRingtone();
      } else if (s.type === "answer" && isHostRef.current) {
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        setStatus("live");
      } else if (s.type === "ice") {
        try {
          await pc.addIceCandidate(s.payload as RTCIceCandidateInit);
        } catch {}
      } else if (s.type === "renegotiate-offer") {
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await fetch(`/api/calls/${roomIdRef.current}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "renegotiate-answer", payload: answer }),
        });
      } else if (s.type === "renegotiate-answer") {
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
      } else if (s.type === "hangup") {
        endCall(false);
      }
    } catch (err) {
      console.warn("[call signal]", err);
    }
  }

  function beginRingTimeout(roomIdToExpire: string) {
    stopRingtone();
    setRingSecondsLeft(60);
    ringtoneRef.current = createRingtonePlayer(ringtone);
    ringtoneRef.current.start();
    ringTickRef.current = setInterval(() => {
      setRingSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    ringTimeoutRef.current = setTimeout(() => {
      // unanswered — stop ring, mark handled, close room if we are host
      stopRingtone();
      handledRoomsRef.current.add(roomIdToExpire);
      setIncoming(null);
      if (statusRef.current === "ringing") {
        setStatus("idle");
      }
      // tell server to close if host still owns it
      fetch(`/api/calls?id=${encodeURIComponent(roomIdToExpire)}`, { method: "DELETE" }).catch(() => {});
      if (roomIdRef.current === roomIdToExpire) {
        endCall(true);
      }
    }, RING_TIMEOUT_MS);
  }

  // Poll for incoming calls — only ring for rooms NOT hosted by me, not already handled, and fresh
  useEffect(() => {
    if (!contextId) return;

    const check = async () => {
      try {
        const res = await fetch(`/api/calls?contextId=${encodeURIComponent(contextId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.me) setMyId(data.me);
        const me = data.me as string | null;
        const rooms = (data.rooms || []) as {
          id: string;
          hostId: string;
          status: string;
          createdAt: number;
        }[];

        const open = rooms.find(
          (r) =>
            r.status === "open" &&
            r.hostId !== me &&
            !handledRoomsRef.current.has(r.id)
        );

        if (open && !roomIdRef.current && statusRef.current === "idle") {
          setIncoming({ id: open.id, hostId: open.hostId });
          setStatus("ringing");
          beginRingTimeout(open.id);
        } else if (!open && statusRef.current === "ringing" && !roomIdRef.current) {
          // room vanished / expired
          stopRingtone();
          setIncoming(null);
          setStatus("idle");
        }
      } catch {}
    };

    check();
    roomPollRef.current = setInterval(check, 2000);
    return () => {
      if (roomPollRef.current) clearInterval(roomPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, ringtone]);

  async function startCall() {
    if (!contextId) return;
    setError(null);
    setStatus("connecting");
    isHostRef.current = true;
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, contextId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");
      setRoomId(data.id);
      roomIdRef.current = data.id;
      handledRoomsRef.current.add(data.id);

      const stream = await getLocalStream(false);
      const pc = await ensurePc();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      await fetch(`/api/calls/${data.id}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "offer", payload: offer }),
      });
      startPolling(data.id);
      // Host also gets a ring timeout — if no one answers in 60s, hang up
      beginRingTimeout(data.id);
      setStatus("live");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start call";
      setError(msg);
      setStatus("error");
      cleanup();
    }
  }

  async function acceptIncoming() {
    if (!incoming) return;
    stopRingtone();
    setStatus("connecting");
    isHostRef.current = false;
    setRoomId(incoming.id);
    roomIdRef.current = incoming.id;
    handledRoomsRef.current.add(incoming.id);
    try {
      const stream = await getLocalStream(false);
      const pc = await ensurePc();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      startPolling(incoming.id);
      setIncoming(null);
      setStatus("live");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not join";
      setError(msg);
      setStatus("error");
      cleanup();
    }
  }

  function declineIncoming() {
    if (incoming) {
      handledRoomsRef.current.add(incoming.id);
      fetch(`/api/calls/${incoming.id}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hangup", payload: {} }),
      }).catch(() => {});
    }
    stopRingtone();
    setIncoming(null);
    setStatus("idle");
  }

  function endCall(notify = true) {
    if (notify && roomIdRef.current) {
      fetch(`/api/calls/${roomIdRef.current}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hangup", payload: {} }),
      }).catch(() => {});
      fetch(`/api/calls?id=${encodeURIComponent(roomIdRef.current)}`, { method: "DELETE" }).catch(() => {});
    }
    cleanup();
    setRoomId(null);
    roomIdRef.current = null;
    setIncoming(null);
    setStatus("idle");
    setMuted(false);
    setCamOn(false);
    setSharing(false);
    isHostRef.current = false;
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }

  async function toggleCam() {
    const pc = pcRef.current;
    if (!pc || !localStreamRef.current) return;

    if (camOn) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
        const sender = pc.getSenders().find((s) => s.track?.id === t.id);
        if (sender) pc.removeTrack(sender);
      });
      setCamOn(false);
      await renegotiate();
      return;
    }

    try {
      const vs = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      const track = vs.getVideoTracks()[0];
      localStreamRef.current.addTrack(track);
      pc.addTrack(track, localStreamRef.current);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setCamOn(true);
      await renegotiate();
    } catch {
      setError("Camera unavailable");
    }
  }

  async function renegotiate() {
    const pc = pcRef.current;
    if (!pc || !roomIdRef.current) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch(`/api/calls/${roomIdRef.current}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "renegotiate-offer", payload: offer }),
      });
    } catch (e) {
      console.warn("[renegotiate]", e);
    }
  }

  async function toggleShare() {
    const pc = pcRef.current;
    if (!pc || !localStreamRef.current) return;

    if (sharing) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        const settings = t.getSettings() as { displaySurface?: string };
        if (settings.displaySurface || t.label.toLowerCase().includes("screen")) {
          t.stop();
          localStreamRef.current?.removeTrack(t);
          const sender = pc.getSenders().find((s) => s.track?.id === t.id);
          if (sender) pc.removeTrack(sender);
        }
      });
      setSharing(false);
      await renegotiate();
      return;
    }

    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = ds.getVideoTracks()[0];
      track.onended = () => {
        setSharing(false);
        const sender = pc.getSenders().find((s) => s.track?.id === track.id);
        if (sender) pc.removeTrack(sender);
        localStreamRef.current?.removeTrack(track);
        renegotiate();
      };
      localStreamRef.current.addTrack(track);
      pc.addTrack(track, localStreamRef.current);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setSharing(true);
      await renegotiate();
    } catch {
      /* user cancelled */
    }
  }

  function selectRingtone(id: RingtoneId) {
    setRingtone(id);
    localStorage.setItem("call-ringtone", id);
    setShowRingtonePicker(false);
    const p = createRingtonePlayer(id);
    p.start();
    setTimeout(() => p.stop(), 1800);
  }

  // ——— Compact ———
  if (compact) {
    return (
      <div className={cn("relative inline-flex", className)}>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        {status === "ringing" ? (
          <button
            type="button"
            onClick={acceptIncoming}
            className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500 animate-pulse"
            title={`Incoming call (${ringSecondsLeft}s)`}
          >
            <PhoneIncoming size={18} />
          </button>
        ) : status === "live" || status === "connecting" ? (
          <button
            type="button"
            onClick={() => endCall()}
            className="p-2 rounded-lg bg-red-500/15 text-red-500"
            title="End call"
          >
            <PhoneOff size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={startCall}
            className="p-2 rounded-lg text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)]"
            title="Start voice call"
          >
            <Phone size={18} />
          </button>
        )}
      </div>
    );
  }

  // ——— Full panel ———
  return (
    <div className={cn("rounded-xl border border-[var(--hq-border)] bg-[var(--hq-bg)]/50 p-3", className)}>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {status === "ringing" && incoming && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 animate-pulse">
            <PhoneIncoming size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Incoming call</p>
            <p className="text-xs text-[var(--hq-muted)]">
              Rings for {ringSecondsLeft}s then stops if unanswered
            </p>
          </div>
          <button
            type="button"
            onClick={acceptIncoming}
            className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600"
          >
            Answer
          </button>
          <button
            type="button"
            onClick={declineIncoming}
            className="px-3 py-1.5 rounded-full border border-[var(--hq-border)] text-xs text-[var(--hq-muted)] hover:bg-[var(--hq-hover)]"
          >
            Decline
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "idle" || status === "error" ? (
          <>
            <button
              type="button"
              onClick={startCall}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--hq-accent)] text-white text-xs font-medium hover:bg-[var(--hq-accent-hover)]"
            >
              <Phone size={14} />
              Start call
            </button>
            <button
              type="button"
              onClick={() => setShowRingtonePicker((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] text-xs"
              title="Ringtone"
            >
              <Volume2 size={14} />
              {RINGTONE_LABELS[ringtone]}
            </button>
          </>
        ) : (
          <>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                status === "live" && "bg-emerald-500/15 text-emerald-600",
                status === "connecting" && "bg-amber-500/15 text-amber-600",
                status === "ringing" && "bg-emerald-500/15 text-emerald-600"
              )}
            >
              {status === "live"
                ? "In call"
                : status === "connecting"
                ? "Connecting…"
                : `Ringing… ${ringSecondsLeft}s`}
            </span>
            <button type="button" onClick={toggleMute} className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]" title={muted ? "Unmute" : "Mute"}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button type="button" onClick={toggleCam} className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]" title={camOn ? "Camera off" : "Camera on"}>
              {camOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
            <button type="button" onClick={toggleShare} className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]" title="Share screen">
              <Monitor size={16} className={sharing ? "text-[var(--hq-accent)]" : ""} />
            </button>
            <button type="button" onClick={() => endCall()} className="p-1.5 rounded-lg bg-red-500/15 text-red-500 hover:bg-red-500/25" title="End call">
              <PhoneOff size={16} />
            </button>
          </>
        )}
      </div>

      {showRingtonePicker && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(RINGTONE_LABELS) as RingtoneId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => selectRingtone(id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs border transition-colors",
                ringtone === id
                  ? "border-[var(--hq-accent)] bg-[var(--hq-accent)]/10 text-[var(--hq-accent)]"
                  : "border-[var(--hq-border)] text-[var(--hq-muted)] hover:bg-[var(--hq-hover)]"
              )}
            >
              {RINGTONE_LABELS[id]}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[var(--hq-danger)]">{error}</p>}

      {(status === "live" || status === "connecting") && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full aspect-video rounded-lg bg-black/40 object-cover" />
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video rounded-lg bg-black/40 object-cover" />
        </div>
      )}
    </div>
  );
}

export { playNotificationTone };
