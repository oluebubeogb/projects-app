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
  PhoneCall,
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

const RING_TIMEOUT_MS = 180_000; // 3 minutes

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

type RemoteMedia = { peerId: string; stream: MediaStream };

export function CallPanel({ kind = "dm", contextId, className, compact = false }: Props) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "ringing" | "connecting" | "live" | "error">("idle");
  const [incoming, setIncoming] = useState<{ id: string; hostId: string; status: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [remoteMedias, setRemoteMedias] = useState<RemoteMedia[]>([]);
  const [ringtone, setRingtone] = useState<RingtoneId>(() => {
    if (typeof window === "undefined") return "chime";
    return (localStorage.getItem("call-ringtone") as RingtoneId) || "chime";
  });
  const [showRingtonePicker, setShowRingtonePicker] = useState(false);
  const [ringSecondsLeft, setRingSecondsLeft] = useState(180);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Host: one PC per remote peer. Guest: single PC to host.
  const hostPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const guestPcRef = useRef<RTCPeerConnection | null>(null);
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
  const myIdRef = useRef<string | null>(null);
  const declinedRoomsRef = useRef<Set<string>>(new Set());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

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

  const updateRemoteMedias = useCallback(() => {
    const list: RemoteMedia[] = [];
    remoteStreamsRef.current.forEach((stream, peerId) => {
      list.push({ peerId, stream });
    });
    setRemoteMedias(list);
    // Mix first remote audio into hidden audio element
    if (remoteAudioRef.current && list[0]) {
      remoteAudioRef.current.srcObject = list[0].stream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    hostPcsRef.current.forEach((pc) => pc.close());
    hostPcsRef.current.clear();
    guestPcRef.current?.close();
    guestPcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteStreamsRef.current.clear();
    setRemoteMedias([]);
    stopRingtone();
  }, [stopRingtone]);

  useEffect(() => () => {
    cleanupMedia();
    if (roomPollRef.current) clearInterval(roomPollRef.current);
  }, [cleanupMedia]);

  function iceServers(): RTCConfiguration {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
  }

  async function postSignal(rid: string, type: string, payload?: unknown, to?: string) {
    await fetch(`/api/calls/${rid}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload, to }),
    });
  }

  function attachLocalTracks(pc: RTCPeerConnection) {
    const stream = localStreamRef.current;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      const already = pc.getSenders().some((s) => s.track?.id === track.id);
      if (!already) pc.addTrack(track, stream);
    }
  }

  function createHostPc(peerId: string): RTCPeerConnection {
    const existing = hostPcsRef.current.get(peerId);
    if (existing) {
      existing.close();
      hostPcsRef.current.delete(peerId);
    }
    const pc = new RTCPeerConnection(iceServers());
    pc.onicecandidate = (e) => {
      if (e.candidate && roomIdRef.current) {
        postSignal(roomIdRef.current, "ice", e.candidate, peerId).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      remoteStreamsRef.current.set(peerId, stream);
      updateRemoteMedias();
    };
    attachLocalTracks(pc);
    hostPcsRef.current.set(peerId, pc);
    return pc;
  }

  function createGuestPc(): RTCPeerConnection {
    guestPcRef.current?.close();
    const pc = new RTCPeerConnection(iceServers());
    pc.onicecandidate = (e) => {
      if (e.candidate && roomIdRef.current) {
        postSignal(roomIdRef.current, "ice", e.candidate).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      remoteStreamsRef.current.set("host", stream);
      updateRemoteMedias();
    };
    attachLocalTracks(pc);
    guestPcRef.current = pc;
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
    sinceRef.current = Date.now() - 1500;
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
    }, 700);
  }

  async function handleSignal(s: {
    from: string;
    to?: string | null;
    type: string;
    payload: unknown;
  }) {
    try {
      // Host receives join-request from a participant → create PC + offer for them
      if (s.type === "join-request" && isHostRef.current) {
        const peerId = s.from;
        const pc = createHostPc(peerId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        await postSignal(roomIdRef.current!, "offer", offer, peerId);
        return;
      }

      // Guest receives offer (targeted or broadcast)
      if (s.type === "offer" && !isHostRef.current) {
        const pc = guestPcRef.current || createGuestPc();
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        attachLocalTracks(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal(roomIdRef.current!, "answer", answer);
        setStatus("live");
        stopRingtone();
        return;
      }

      // Host receives answer from a specific peer
      if (s.type === "answer" && isHostRef.current) {
        const pc = hostPcsRef.current.get(s.from);
        if (pc) {
          await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        }
        setStatus("live");
        return;
      }

      if (s.type === "ice") {
        const candidate = s.payload as RTCIceCandidateInit;
        if (isHostRef.current) {
          const pc = hostPcsRef.current.get(s.from);
          if (pc) {
            try {
              await pc.addIceCandidate(candidate);
            } catch {}
          }
        } else if (guestPcRef.current) {
          try {
            await guestPcRef.current.addIceCandidate(candidate);
          } catch {}
        }
        return;
      }

      // Peer left — host cleans their PC; room stays open
      if (s.type === "leave") {
        if (isHostRef.current) {
          const pc = hostPcsRef.current.get(s.from);
          if (pc) {
            pc.close();
            hostPcsRef.current.delete(s.from);
          }
          remoteStreamsRef.current.delete(s.from);
          updateRemoteMedias();
        }
        return;
      }

      // Whole room ended
      if (s.type === "hangup") {
        leaveCall(false, true);
        return;
      }

      // Renegotiation for screen/cam (host → specific peer or guest)
      if (s.type === "renegotiate-offer") {
        const pc = isHostRef.current
          ? hostPcsRef.current.get(s.from)
          : guestPcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal(
          roomIdRef.current!,
          "renegotiate-answer",
          answer,
          isHostRef.current ? undefined : s.from
        );
        return;
      }
      if (s.type === "renegotiate-answer") {
        const pc = isHostRef.current
          ? hostPcsRef.current.get(s.from)
          : guestPcRef.current;
        if (pc) {
          await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        }
      }
    } catch (err) {
      console.warn("[call signal]", err);
    }
  }

  function beginRingTimeout(roomIdToExpire: string, playSound: boolean) {
    stopRingtone();
    setRingSecondsLeft(180);
    if (playSound) {
      ringtoneRef.current = createRingtonePlayer(ringtone);
      ringtoneRef.current.start();
    }
    ringTickRef.current = setInterval(() => {
      setRingSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    ringTimeoutRef.current = setTimeout(() => {
      stopRingtone();
      // Only clear ringing UI — do not kill a live call
      if (statusRef.current === "ringing") {
        setIncoming((cur) => (cur?.id === roomIdToExpire ? null : cur));
        setStatus("idle");
      }
    }, RING_TIMEOUT_MS);
  }

  // Discover open / live rooms — ring for open, show Join for live
  useEffect(() => {
    if (!contextId) return;

    const check = async () => {
      try {
        const res = await fetch(`/api/calls?contextId=${encodeURIComponent(contextId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.me) setMyId(data.me);
        const me = (data.me as string) || myIdRef.current;
        const rooms = (data.rooms || []) as {
          id: string;
          hostId: string;
          status: string;
          createdAt: number;
        }[];

        // Already in a call — ignore
        if (roomIdRef.current || statusRef.current === "live" || statusRef.current === "connecting") {
          return;
        }

        const ringing = rooms.find(
          (r) =>
            r.status === "open" &&
            r.hostId !== me &&
            !declinedRoomsRef.current.has(r.id)
        );
        // Live rooms can always be joined/rejoined (even if ring was declined)
        const liveRoom = rooms.find((r) => r.status === "live" && r.hostId !== me);

        if (ringing && statusRef.current === "idle") {
          setIncoming({ id: ringing.id, hostId: ringing.hostId, status: "open" });
          setStatus("ringing");
          beginRingTimeout(ringing.id, true);
        } else if (liveRoom && statusRef.current === "idle") {
          // Ongoing call others can still join — no ring, just join affordance
          stopRingtone();
          setIncoming({ id: liveRoom.id, hostId: liveRoom.hostId, status: "live" });
          // stay idle visually but show join via incoming banner with status live
          setStatus("idle");
        } else if (!ringing && !liveRoom && statusRef.current === "ringing") {
          stopRingtone();
          setIncoming(null);
          setStatus("idle");
        } else if (liveRoom && statusRef.current === "ringing") {
          // Someone answered — stop MY ring but keep ability to join
          stopRingtone();
          setIncoming({ id: liveRoom.id, hostId: liveRoom.hostId, status: "live" });
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

      await getLocalStream(false);
      startPolling(data.id);
      // Host waits for join-request from each peer (works for 1:1 and groups)
      setStatus("live");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start call";
      setError(msg);
      setStatus("error");
      cleanupMedia();
    }
  }

  async function joinRoom(targetRoomId: string) {
    stopRingtone();
    setStatus("connecting");
    isHostRef.current = false;
    setRoomId(targetRoomId);
    roomIdRef.current = targetRoomId;
    setIncoming(null);
    try {
      await getLocalStream(false);
      createGuestPc();
      startPolling(targetRoomId);
      // Ask host for an offer
      await postSignal(targetRoomId, "join-request", {});
      // Mark room live so it stays open for others
      fetch("/api/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetRoomId, status: "live" }),
      }).catch(() => {});
      setStatus("live");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not join";
      setError(msg);
      setStatus("error");
      cleanupMedia();
    }
  }

  function acceptIncoming() {
    if (!incoming) return;
    joinRoom(incoming.id);
  }

  function declineIncoming() {
    if (incoming) {
      // Only decline for this user — room stays active for others
      declinedRoomsRef.current.add(incoming.id);
    }
    stopRingtone();
    setIncoming(null);
    setStatus("idle");
  }

  /** Leave without ending the room for everyone */
  function leaveCall(notifyLeave = true, forcedHangup = false) {
    const rid = roomIdRef.current;
    if (rid && notifyLeave && !forcedHangup) {
      postSignal(rid, "leave", {}).catch(() => {});
    }
    if (forcedHangup && rid) {
      postSignal(rid, "hangup", {}).catch(() => {});
      fetch(`/api/calls?id=${encodeURIComponent(rid)}`, { method: "DELETE" }).catch(() => {});
    }
    // Host ending entirely
    if (isHostRef.current && rid && !forcedHangup) {
      // If host leaves, end room for everyone (star topology needs host)
      postSignal(rid, "hangup", {}).catch(() => {});
      fetch(`/api/calls?id=${encodeURIComponent(rid)}`, { method: "DELETE" }).catch(() => {});
    }
    cleanupMedia();
    setRoomId(null);
    roomIdRef.current = null;
    setIncoming(null);
    setStatus("idle");
    setMuted(false);
    setCamOn(false);
    setSharing(false);
    isHostRef.current = false;
  }

  function endCallForEveryone() {
    leaveCall(false, true);
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }

  async function renegotiateAll() {
    if (isHostRef.current) {
      for (const [peerId, pc] of hostPcsRef.current) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await postSignal(roomIdRef.current!, "renegotiate-offer", offer, peerId);
        } catch (e) {
          console.warn("[renegotiate host]", e);
        }
      }
    } else if (guestPcRef.current && roomIdRef.current) {
      try {
        const offer = await guestPcRef.current.createOffer();
        await guestPcRef.current.setLocalDescription(offer);
        await postSignal(roomIdRef.current, "renegotiate-offer", offer);
      } catch (e) {
        console.warn("[renegotiate guest]", e);
      }
    }
  }

  async function toggleCam() {
    if (!localStreamRef.current) return;
    if (camOn) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
        const removeFrom = (pc: RTCPeerConnection) => {
          const sender = pc.getSenders().find((s) => s.track?.id === t.id);
          if (sender) pc.removeTrack(sender);
        };
        hostPcsRef.current.forEach(removeFrom);
        if (guestPcRef.current) removeFrom(guestPcRef.current);
      });
      setCamOn(false);
      await renegotiateAll();
      return;
    }
    try {
      const vs = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      const track = vs.getVideoTracks()[0];
      localStreamRef.current.addTrack(track);
      hostPcsRef.current.forEach((pc) => pc.addTrack(track, localStreamRef.current!));
      if (guestPcRef.current) guestPcRef.current.addTrack(track, localStreamRef.current);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setCamOn(true);
      await renegotiateAll();
    } catch {
      setError("Camera unavailable");
    }
  }

  async function toggleShare() {
    if (!localStreamRef.current) return;
    if (sharing) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        const settings = t.getSettings() as { displaySurface?: string };
        if (settings.displaySurface || t.label.toLowerCase().includes("screen")) {
          t.stop();
          localStreamRef.current?.removeTrack(t);
          const removeFrom = (pc: RTCPeerConnection) => {
            const sender = pc.getSenders().find((s) => s.track?.id === t.id);
            if (sender) pc.removeTrack(sender);
          };
          hostPcsRef.current.forEach(removeFrom);
          if (guestPcRef.current) removeFrom(guestPcRef.current);
        }
      });
      setSharing(false);
      await renegotiateAll();
      return;
    }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = ds.getVideoTracks()[0];
      track.onended = () => {
        setSharing(false);
        localStreamRef.current?.removeTrack(track);
        const removeFrom = (pc: RTCPeerConnection) => {
          const sender = pc.getSenders().find((s) => s.track?.id === track.id);
          if (sender) pc.removeTrack(sender);
        };
        hostPcsRef.current.forEach(removeFrom);
        if (guestPcRef.current) removeFrom(guestPcRef.current);
        renegotiateAll();
      };
      localStreamRef.current.addTrack(track);
      hostPcsRef.current.forEach((pc) => pc.addTrack(track, localStreamRef.current!));
      if (guestPcRef.current) guestPcRef.current.addTrack(track, localStreamRef.current);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setSharing(true);
      await renegotiateAll();
    } catch {
      /* cancelled */
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

  const inCall = status === "live" || status === "connecting";
  const showJoinLive = !inCall && incoming?.status === "live";
  const showIncomingRing = status === "ringing" && incoming?.status === "open";

  // ——— Compact ———
  if (compact) {
    return (
      <div className={cn("relative inline-flex", className)}>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        {showIncomingRing ? (
          <button type="button" onClick={acceptIncoming} className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500 animate-pulse" title="Answer">
            <PhoneIncoming size={18} />
          </button>
        ) : showJoinLive ? (
          <button type="button" onClick={acceptIncoming} className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600" title="Join call">
            <PhoneCall size={18} />
          </button>
        ) : inCall ? (
          <button type="button" onClick={() => leaveCall(true)} className="p-2 rounded-lg bg-red-500/15 text-red-500" title="Leave call">
            <PhoneOff size={18} />
          </button>
        ) : (
          <button type="button" onClick={startCall} className="p-2 rounded-lg text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)]" title="Start call">
            <Phone size={18} />
          </button>
        )}
      </div>
    );
  }

  // ——— Full ———
  return (
    <div className={cn("rounded-xl border border-[var(--hq-border)] bg-[var(--hq-bg)]/50 p-3", className)}>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {showIncomingRing && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 animate-pulse">
            <PhoneIncoming size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Incoming call</p>
            <p className="text-xs text-[var(--hq-muted)]">
              {ringSecondsLeft}s left — others can still join after someone answers
            </p>
          </div>
          <button type="button" onClick={acceptIncoming} className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600">
            Answer
          </button>
          <button type="button" onClick={declineIncoming} className="px-3 py-1.5 rounded-full border border-[var(--hq-border)] text-xs text-[var(--hq-muted)] hover:bg-[var(--hq-hover)]">
            Decline
          </button>
        </div>
      )}

      {showJoinLive && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--hq-accent)]/10 border border-[var(--hq-accent)]/30 px-3 py-3">
          <div className="w-10 h-10 rounded-full bg-[var(--hq-accent)]/20 flex items-center justify-center text-[var(--hq-accent)]">
            <PhoneCall size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Call in progress</p>
            <p className="text-xs text-[var(--hq-muted)]">Join anytime while the room is active</p>
          </div>
          <button type="button" onClick={acceptIncoming} className="px-3 py-1.5 rounded-full bg-[var(--hq-accent)] text-white text-xs font-medium hover:bg-[var(--hq-accent-hover)]">
            Join
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!inCall ? (
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
            >
              <Volume2 size={14} />
              {RINGTONE_LABELS[ringtone]}
            </button>
          </>
        ) : (
          <>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", status === "live" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
              {status === "live" ? "In call" : "Connecting…"}
            </span>
            <button type="button" onClick={toggleMute} className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]" title={muted ? "Unmute" : "Mute"}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button type="button" onClick={toggleCam} className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]" title="Camera">
              {camOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
            <button type="button" onClick={toggleShare} className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]" title="Share screen">
              <Monitor size={16} className={sharing ? "text-[var(--hq-accent)]" : ""} />
            </button>
            <button type="button" onClick={() => leaveCall(true)} className="px-2 py-1 rounded-lg bg-red-500/15 text-red-500 text-xs font-medium hover:bg-red-500/25" title="Leave (others stay)">
              Leave
            </button>
            {isHostRef.current && (
              <button type="button" onClick={endCallForEveryone} className="px-2 py-1 rounded-lg border border-red-500/40 text-red-500 text-xs hover:bg-red-500/10" title="End for everyone">
                End all
              </button>
            )}
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

      {inCall && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full aspect-video rounded-lg bg-black/40 object-cover" />
          {remoteMedias[0] ? (
            <video
              autoPlay
              playsInline
              className="w-full aspect-video rounded-lg bg-black/40 object-cover"
              ref={(el) => {
                if (el && remoteMedias[0]) el.srcObject = remoteMedias[0].stream;
              }}
            />
          ) : (
            <div className="w-full aspect-video rounded-lg bg-black/40 flex items-center justify-center text-xs text-white/50">
              Waiting for others…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { playNotificationTone };
