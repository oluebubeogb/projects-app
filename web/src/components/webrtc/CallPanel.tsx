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
  Maximize2,
  Minimize2,
  PanelLeft,
  X,
  Expand,
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

const RING_TIMEOUT_MS = 180_000;

const SCREEN_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 15, max: 24 },
};

const CAM_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640, max: 1280 },
  height: { ideal: 480, max: 720 },
  frameRate: { ideal: 24, max: 30 },
};

function storageKey(contextId: string) {
  return `call-room:${contextId}`;
}

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

type RemoteMedia = {
  peerId: string;
  stream: MediaStream;
  name?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  isScreen?: boolean;
};

type ViewMode = "inline" | "call" | "sidebar";

function shortLabel(id: string, name?: string) {
  if (name && name.trim()) return name.trim();
  if (!id || id === "local") return "You";
  if (id === "host") return "Host";
  return id.length > 10 ? id.slice(0, 6) + "…" : id;
}

function StableVideo({
  stream,
  muted = false,
  className,
  mirror = false,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  mirror?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastStreamId = useRef<string | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const sid = stream?.id ?? null;
    if (sid === lastStreamId.current) return;
    lastStreamId.current = sid;
    if (stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={cn(className, mirror && "scale-x-[-1]")}
    />
  );
}

async function captureLastFrame(track: MediaStreamTrack): Promise<string | null> {
  try {
    const stream = new MediaStream([track]);
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => {});
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(w, 1280);
    canvas.height = Math.min(h, 720);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.srcObject = null;
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

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
  const [viewMode, setViewMode] = useState<ViewMode>("inline");
  const [focusedPeerId, setFocusedPeerId] = useState<string | null>(null);
  const [stoppedFrames, setStoppedFrames] = useState<Record<string, string>>({});
  const [myName] = useState<string>("You");
  const [peerNames, setPeerNames] = useState<
    Record<string, { name?: string; avatarUrl?: string | null; avatarColor?: string }>
  >({});

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  /** Mesh: one RTCPeerConnection per remote peer (everyone connects to everyone) */
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
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
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const makingOfferRef = useRef<Set<string>>(new Set());
  const autoRejoinTriedRef = useRef(false);

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
      const info = peerNames[peerId];
      const hasVideo = stream.getVideoTracks().some((t) => t.readyState === "live");
      const isScreen = stream.getVideoTracks().some((t) => {
        const s = t.getSettings() as { displaySurface?: string };
        return !!(s.displaySurface || t.label.toLowerCase().includes("screen"));
      });
      list.push({
        peerId,
        stream,
        name: info?.name,
        avatarUrl: info?.avatarUrl,
        avatarColor: info?.avatarColor,
        isScreen: isScreen && hasVideo,
      });
    });
    setRemoteMedias(list);
    if (remoteAudioRef.current) {
      const withAudio = list.find((m) => m.stream.getAudioTracks().length > 0);
      if (withAudio) {
        remoteAudioRef.current.srcObject = withAudio.stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [peerNames]);

  const cleanupMedia = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenTrackRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteStreamsRef.current.clear();
    setRemoteMedias([]);
    setStoppedFrames({});
    setFocusedPeerId(null);
    setViewMode("inline");
    makingOfferRef.current.clear();
    stopRingtone();
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch {}
  }, [stopRingtone]);

  useEffect(
    () => () => {
      cleanupMedia();
      if (roomPollRef.current) clearInterval(roomPollRef.current);
    },
    [cleanupMedia]
  );

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

  function createPc(peerId: string): RTCPeerConnection {
    const existing = pcsRef.current.get(peerId);
    if (existing) {
      existing.close();
      pcsRef.current.delete(peerId);
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
      const prev = remoteStreamsRef.current.get(peerId);
      if (prev && prev.id !== stream.id) {
        stream.getTracks().forEach((t) => {
          if (!prev.getTracks().some((pt) => pt.id === t.id)) {
            prev.addTrack(t);
          }
        });
        // also update existing tracks that were replaced
        remoteStreamsRef.current.set(peerId, prev);
      } else {
        remoteStreamsRef.current.set(peerId, stream);
      }
      // listen for track end so we can show stopped state
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => {
          updateRemoteMedias();
        };
      });
      updateRemoteMedias();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        // keep stream until explicit leave so UI doesn't flicker
      }
    };
    attachLocalTracks(pc);
    pcsRef.current.set(peerId, pc);
    return pc;
  }

  async function getLocalStream(video: boolean) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: video ? CAM_CONSTRAINTS : false,
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
    const me = myIdRef.current;
    // Ignore signals targeted to someone else
    if (s.to && me && s.to !== me) return;
    // Ignore our own broadcasts
    if (s.from === me) return;

    try {
      // Mesh: any participant who receives join-request offers a connection to the new peer
      if (s.type === "join-request") {
        const peerId = s.from;
        const payload = (s.payload || {}) as {
          name?: string;
          avatarUrl?: string | null;
          avatarColor?: string;
        };
        if (payload.name || payload.avatarUrl) {
          setPeerNames((prev) => ({
            ...prev,
            [peerId]: {
              name: payload.name,
              avatarUrl: payload.avatarUrl,
              avatarColor: payload.avatarColor,
            },
          }));
        }
        // Perfect negotiation style: only create offer if we don't already have a PC
        // or if our id is "greater" (avoid glare) — simple: always answer role for join-request receiver
        if (!pcsRef.current.has(peerId) && !makingOfferRef.current.has(peerId)) {
          makingOfferRef.current.add(peerId);
          try {
            const pc = createPc(peerId);
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);
            await postSignal(roomIdRef.current!, "offer", offer, peerId);
          } finally {
            makingOfferRef.current.delete(peerId);
          }
        }
        return;
      }

      if (s.type === "offer") {
        const peerId = s.from;
        let pc = pcsRef.current.get(peerId);
        if (!pc) pc = createPc(peerId);
        // If we are in the middle of making an offer (glare), prefer polite peer:
        // simple approach: always accept remote offer (rollback if needed)
        if (pc.signalingState === "have-local-offer") {
          try {
            await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
          } catch {}
        }
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        attachLocalTracks(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal(roomIdRef.current!, "answer", answer, peerId);
        setStatus("live");
        stopRingtone();
        return;
      }

      if (s.type === "answer") {
        const pc = pcsRef.current.get(s.from);
        if (pc) {
          try {
            await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
          } catch (e) {
            console.warn("[answer]", e);
          }
        }
        setStatus("live");
        return;
      }

      if (s.type === "ice") {
        const candidate = s.payload as RTCIceCandidateInit;
        const pc = pcsRef.current.get(s.from);
        if (pc) {
          try {
            await pc.addIceCandidate(candidate);
          } catch {}
        }
        return;
      }

      if (s.type === "leave") {
        const pc = pcsRef.current.get(s.from);
        if (pc) {
          pc.close();
          pcsRef.current.delete(s.from);
        }
        remoteStreamsRef.current.delete(s.from);
        setStoppedFrames((prev) => {
          const next = { ...prev };
          delete next[s.from];
          return next;
        });
        updateRemoteMedias();
        return;
      }

      if (s.type === "hangup") {
        leaveCall(false, true);
        return;
      }

      if (s.type === "renegotiate-offer") {
        const pc = pcsRef.current.get(s.from);
        if (!pc) return;
        await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal(roomIdRef.current!, "renegotiate-answer", answer, s.from);
        return;
      }

      if (s.type === "renegotiate-answer") {
        const pc = pcsRef.current.get(s.from);
        if (pc) {
          try {
            await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
          } catch {}
        }
        return;
      }

      if (s.type === "peer-info") {
        const p = (s.payload || {}) as {
          name?: string;
          avatarUrl?: string | null;
          avatarColor?: string;
        };
        setPeerNames((prev) => ({
          ...prev,
          [s.from]: { name: p.name, avatarUrl: p.avatarUrl, avatarColor: p.avatarColor },
        }));
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
      if (statusRef.current === "ringing") {
        setIncoming((cur) => (cur?.id === roomIdToExpire ? null : cur));
        setStatus("idle");
      }
    }, RING_TIMEOUT_MS);
  }

  // Discover rooms + auto-rejoin after refresh
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

        // Already in a call
        if (roomIdRef.current || statusRef.current === "live" || statusRef.current === "connecting") {
          return;
        }

        // Auto-rejoin after page refresh if we had stored a room id that is still live
        if (!autoRejoinTriedRef.current && typeof window !== "undefined") {
          autoRejoinTriedRef.current = true;
          const saved = sessionStorage.getItem(storageKey(contextId));
          if (saved) {
            const stillLive = rooms.find((r) => r.id === saved && (r.status === "live" || r.status === "open"));
            if (stillLive) {
              // rejoin without creating a new room
              joinRoom(stillLive.id, stillLive.hostId === me);
              return;
            }
            sessionStorage.removeItem(storageKey(contextId));
          }
        }

        const ringing = rooms.find(
          (r) => r.status === "open" && r.hostId !== me && !declinedRoomsRef.current.has(r.id)
        );
        const liveRoom = rooms.find((r) => r.status === "live" && r.hostId !== me);
        // Also surface live room even if we are the original host (refresh case handled above)
        const anyLive = rooms.find((r) => r.status === "live");

        if (ringing && statusRef.current === "idle") {
          setIncoming({ id: ringing.id, hostId: ringing.hostId, status: "open" });
          setStatus("ringing");
          beginRingTimeout(ringing.id, true);
        } else if ((liveRoom || anyLive) && statusRef.current === "idle") {
          const target = liveRoom || anyLive!;
          stopRingtone();
          setIncoming({ id: target.id, hostId: target.hostId, status: "live" });
          setStatus("idle");
        } else if (!ringing && !liveRoom && !anyLive && statusRef.current === "ringing") {
          stopRingtone();
          setIncoming(null);
          setStatus("idle");
        } else if ((liveRoom || anyLive) && statusRef.current === "ringing") {
          const target = liveRoom || anyLive!;
          stopRingtone();
          setIncoming({ id: target.id, hostId: target.hostId, status: "live" });
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

    // If a live room already exists for this context, join it instead of starting a parallel call
    try {
      const res = await fetch(`/api/calls?contextId=${encodeURIComponent(contextId)}`);
      if (res.ok) {
        const data = await res.json();
        const rooms = (data.rooms || []) as { id: string; hostId: string; status: string }[];
        const live = rooms.find((r) => r.status === "live" || r.status === "open");
        if (live) {
          await joinRoom(live.id, live.hostId === (data.me || myIdRef.current));
          return;
        }
      }
    } catch {}

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
      if (contextId) sessionStorage.setItem(storageKey(contextId), data.id);

      await getLocalStream(false);
      startPolling(data.id);
      setStatus("live");
      setViewMode("call");
      enterBrowserFullscreen();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start call";
      setError(msg);
      setStatus("error");
      cleanupMedia();
    }
  }

  async function joinRoom(targetRoomId: string, asHost = false) {
    stopRingtone();
    setStatus("connecting");
    isHostRef.current = asHost;
    setRoomId(targetRoomId);
    roomIdRef.current = targetRoomId;
    setIncoming(null);
    if (contextId) sessionStorage.setItem(storageKey(contextId), targetRoomId);
    try {
      await getLocalStream(false);
      startPolling(targetRoomId);
      // Broadcast join-request so EVERY existing participant creates a PC to us (mesh)
      await postSignal(targetRoomId, "join-request", {
        name: myName !== "You" ? myName : undefined,
      });
      fetch("/api/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetRoomId, status: "live" }),
      }).catch(() => {});
      setStatus("live");
      setViewMode("call");
      enterBrowserFullscreen();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not join";
      setError(msg);
      setStatus("error");
      cleanupMedia();
    }
  }

  function acceptIncoming() {
    if (!incoming) return;
    joinRoom(incoming.id, false);
  }

  function declineIncoming() {
    if (incoming) {
      declinedRoomsRef.current.add(incoming.id);
    }
    stopRingtone();
    setIncoming(null);
    setStatus("idle");
  }

  function leaveCall(notifyLeave = true, forcedHangup = false) {
    const rid = roomIdRef.current;
    if (rid && notifyLeave && !forcedHangup) {
      postSignal(rid, "leave", {}).catch(() => {});
    }
    if (forcedHangup && rid) {
      postSignal(rid, "hangup", {}).catch(() => {});
      fetch(`/api/calls?id=${encodeURIComponent(rid)}`, { method: "DELETE" }).catch(() => {});
    }
    // Host leaving ends room for everyone (optional policy — keep for compatibility)
    if (isHostRef.current && rid && !forcedHangup) {
      postSignal(rid, "hangup", {}).catch(() => {});
      fetch(`/api/calls?id=${encodeURIComponent(rid)}`, { method: "DELETE" }).catch(() => {});
    }
    if (contextId) {
      try {
        sessionStorage.removeItem(storageKey(contextId));
      } catch {}
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

  function enterBrowserFullscreen() {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    } catch {}
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }

  async function renegotiateAll() {
    for (const [peerId, pc] of pcsRef.current) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSignal(roomIdRef.current!, "renegotiate-offer", offer, peerId);
      } catch (e) {
        console.warn("[renegotiate]", e);
      }
    }
  }

  async function toggleCam() {
    if (!localStreamRef.current) return;
    if (camOn) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        const settings = t.getSettings() as { displaySurface?: string };
        if (!settings.displaySurface && !t.label.toLowerCase().includes("screen")) {
          t.stop();
          localStreamRef.current?.removeTrack(t);
          pcsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.id === t.id);
            if (sender) pc.removeTrack(sender);
          });
        }
      });
      setCamOn(false);
      await renegotiateAll();
      return;
    }
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: CAM_CONSTRAINTS });
      const track = vs.getVideoTracks()[0];
      localStreamRef.current.addTrack(track);
      pcsRef.current.forEach((pc) => {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender && !videoSender.track) {
          videoSender.replaceTrack(track).catch(() => pc.addTrack(track, localStreamRef.current!));
        } else if (!videoSender) {
          pc.addTrack(track, localStreamRef.current!);
        } else {
          // already have a video (maybe screen) — add additional track
          pc.addTrack(track, localStreamRef.current!);
        }
      });
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
      const track = screenTrackRef.current;
      if (track) {
        const frame = await captureLastFrame(track.clone());
        if (frame) setStoppedFrames((prev) => ({ ...prev, local: frame }));
        track.stop();
        localStreamRef.current.removeTrack(track);
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.id === track.id);
          if (sender) pc.removeTrack(sender);
        });
        screenTrackRef.current = null;
      } else {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          const settings = t.getSettings() as { displaySurface?: string };
          if (settings.displaySurface || t.label.toLowerCase().includes("screen")) {
            t.stop();
            localStreamRef.current?.removeTrack(t);
            pcsRef.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.id === t.id);
              if (sender) pc.removeTrack(sender);
            });
          }
        });
      }
      setSharing(false);
      await renegotiateAll();
      return;
    }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_CONSTRAINTS,
        audio: false,
      });
      const track = ds.getVideoTracks()[0];
      try {
        await track.applyConstraints(SCREEN_CONSTRAINTS);
      } catch {}
      screenTrackRef.current = track;
      track.onended = async () => {
        setSharing(false);
        const frame = await captureLastFrame(track.clone());
        if (frame) setStoppedFrames((prev) => ({ ...prev, local: frame }));
        localStreamRef.current?.removeTrack(track);
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.id === track.id);
          if (sender) pc.removeTrack(sender);
        });
        screenTrackRef.current = null;
        renegotiateAll();
      };
      localStreamRef.current.addTrack(track);
      pcsRef.current.forEach((pc) => {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(track).catch(() => {
            pc.addTrack(track, localStreamRef.current!);
          });
        } else {
          pc.addTrack(track, localStreamRef.current!);
        }
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setSharing(true);
      setStoppedFrames((prev) => {
        const next = { ...prev };
        delete next.local;
        return next;
      });
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

  const allTiles: {
    id: string;
    stream: MediaStream | null;
    name: string;
    avatarUrl?: string | null;
    avatarColor?: string;
    isLocal: boolean;
    isScreen?: boolean;
    stoppedFrame?: string;
  }[] = [];

  allTiles.push({
    id: "local",
    stream: localStreamRef.current,
    name: shortLabel("local", myName),
    isLocal: true,
    isScreen: sharing,
    stoppedFrame: stoppedFrames.local,
  });

  remoteMedias.forEach((rm) => {
    const hasLiveVideo = rm.stream.getVideoTracks().some((t) => t.readyState === "live");
    allTiles.push({
      id: rm.peerId,
      stream: hasLiveVideo ? rm.stream : null,
      name: shortLabel(rm.peerId, rm.name || peerNames[rm.peerId]?.name),
      avatarUrl: rm.avatarUrl || peerNames[rm.peerId]?.avatarUrl,
      avatarColor: rm.avatarColor || peerNames[rm.peerId]?.avatarColor,
      isLocal: false,
      isScreen: rm.isScreen,
      stoppedFrame: !hasLiveVideo ? stoppedFrames[rm.peerId] : undefined,
    });
  });

  const focused =
    focusedPeerId && allTiles.find((t) => t.id === focusedPeerId)
      ? allTiles.find((t) => t.id === focusedPeerId)!
      : allTiles.find((t) => t.isScreen && t.stream) || allTiles[0];

  if (compact) {
    return (
      <div className={cn("relative inline-flex", className)}>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        {showIncomingRing ? (
          <button
            type="button"
            onClick={acceptIncoming}
            className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500 animate-pulse"
            title="Answer"
          >
            <PhoneIncoming size={18} />
          </button>
        ) : showJoinLive ? (
          <button
            type="button"
            onClick={acceptIncoming}
            className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600"
            title="Join call"
          >
            <PhoneCall size={18} />
          </button>
        ) : inCall ? (
          <button
            type="button"
            onClick={() => leaveCall(true)}
            className="p-2 rounded-lg bg-red-500/15 text-red-500"
            title="Leave call"
          >
            <PhoneOff size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={startCall}
            className="p-2 rounded-lg text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)]"
            title="Start call"
          >
            <Phone size={18} />
          </button>
        )}
      </div>
    );
  }

  const Toolbar = ({ dense = false }: { dense?: boolean }) => (
    <div className={cn("flex flex-wrap items-center gap-1.5", dense && "gap-1")}>
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
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              status === "live" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
            )}
          >
            {status === "live" ? "In call" : "Connecting…"}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="button"
            onClick={toggleCam}
            className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
            title="Camera"
          >
            {camOn ? <Video size={16} /> : <VideoOff size={16} />}
          </button>
          <button
            type="button"
            onClick={toggleShare}
            className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
            title="Share screen"
          >
            <Monitor size={16} className={sharing ? "text-[var(--hq-accent)]" : ""} />
          </button>
          {viewMode === "inline" && (
            <button
              type="button"
              onClick={() => {
                setViewMode("call");
                enterBrowserFullscreen();
              }}
              className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
              title="Call mode (fullscreen)"
            >
              <Maximize2 size={16} />
            </button>
          )}
          {viewMode === "call" && (
            <>
              <button
                type="button"
                onClick={() => setViewMode("sidebar")}
                className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
                title="Sidebar mode"
              >
                <PanelLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("inline");
                  try {
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                  } catch {}
                }}
                className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
                title="Exit fullscreen"
              >
                <Minimize2 size={16} />
              </button>
            </>
          )}
          {viewMode === "sidebar" && (
            <>
              <button
                type="button"
                onClick={() => setViewMode("call")}
                className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
                title="Call mode"
              >
                <Maximize2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("inline");
                  try {
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                  } catch {}
                }}
                className="p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
                title="Exit fullscreen"
              >
                <Minimize2 size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => leaveCall(true)}
            className="px-2 py-1 rounded-lg bg-red-500/15 text-red-500 text-xs font-medium hover:bg-red-500/25"
            title="Leave (others stay)"
          >
            Leave
          </button>
          {isHostRef.current && (
            <button
              type="button"
              onClick={endCallForEveryone}
              className="px-2 py-1 rounded-lg border border-red-500/40 text-red-500 text-xs hover:bg-red-500/10"
              title="End for everyone"
            >
              End all
            </button>
          )}
        </>
      )}
    </div>
  );

  function ScreenCard({
    tile,
    onFocus,
  }: {
    tile: (typeof allTiles)[0];
    onFocus?: () => void;
  }) {
    const hasLive = !!tile.stream?.getVideoTracks().some((t) => t.readyState === "live");
    const showStopped = !hasLive && !!tile.stoppedFrame;

    return (
      <div className="flex flex-col min-w-0">
        <div className="relative w-full overflow-hidden rounded-lg bg-black/50 aspect-video">
          {hasLive && tile.stream ? (
            <StableVideo
              stream={tile.stream}
              muted={tile.isLocal}
              mirror={tile.isLocal && !tile.isScreen}
              className="w-full h-full object-contain"
            />
          ) : showStopped ? (
            <div className="relative w-full h-full">
              <img
                src={tile.stoppedFrame}
                alt=""
                className="w-full h-full object-cover blur-md scale-105 brightness-75"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="rounded-full overflow-hidden border-2 border-white/40 shadow-lg flex items-center justify-center text-white font-semibold"
                  style={{
                    width: "20%",
                    height: "20%",
                    minWidth: 36,
                    minHeight: 36,
                    background: tile.avatarColor || "var(--hq-accent)",
                  }}
                >
                  {tile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[clamp(10px,2.5vw,16px)]">
                      {(tile.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs text-white/50">
              {tile.isLocal ? (camOn || sharing ? "…" : "No video") : "Waiting…"}
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 min-w-0 px-0.5">
          <span
            className="text-[10px] sm:text-[11px] font-bold text-[var(--hq-text)] truncate leading-tight"
            title={tile.name}
          >
            {tile.name}
            {tile.isLocal ? " (you)" : ""}
          </span>
          {onFocus && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className="shrink-0 p-0.5 rounded text-[var(--hq-muted)] hover:text-[var(--hq-accent)] hover:bg-[var(--hq-hover)]"
              title="Show fullscreen"
            >
              <Expand size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fullscreen call / sidebar mode — covers project header; browser chrome via Fullscreen API
  if (inCall && (viewMode === "call" || viewMode === "sidebar")) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[var(--hq-bg)] flex flex-col">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--hq-border)] bg-[var(--hq-bg)]/95 backdrop-blur">
          <Toolbar dense />
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setViewMode("inline");
              try {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              } catch {}
            }}
            className="p-1.5 rounded-lg text-[var(--hq-muted)] hover:bg-[var(--hq-hover)]"
            title="Exit call mode"
          >
            <X size={18} />
          </button>
        </div>

        {viewMode === "call" && (
          <div className="flex-1 min-h-0 p-3 overflow-auto">
            <div
              className={cn(
                "grid gap-3 h-full",
                allTiles.length <= 1
                  ? "grid-cols-1"
                  : allTiles.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : allTiles.length <= 4
                      ? "grid-cols-2"
                      : "grid-cols-2 lg:grid-cols-3"
              )}
            >
              {allTiles.map((tile) => (
                <ScreenCard
                  key={tile.id}
                  tile={tile}
                  onFocus={() => {
                    setFocusedPeerId(tile.id);
                    setViewMode("sidebar");
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {viewMode === "sidebar" && (
          <div className="flex-1 min-h-0 flex">
            <div className="w-[20%] min-w-[120px] max-w-[280px] border-r border-[var(--hq-border)] overflow-y-auto p-2 space-y-2 bg-[var(--hq-bg)]/80">
              {allTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setFocusedPeerId(tile.id)}
                  className={cn(
                    "w-full text-left rounded-lg transition-shadow focus:outline-none",
                    focusedPeerId === tile.id || (!focusedPeerId && focused?.id === tile.id)
                      ? "ring-2 ring-[var(--hq-accent)]"
                      : "hover:ring-1 hover:ring-[var(--hq-border)]"
                  )}
                >
                  <ScreenCard
                    tile={tile}
                    onFocus={() => setFocusedPeerId(tile.id)}
                  />
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-0 p-3 flex flex-col">
              {focused ? (
                <>
                  <div
                    className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-black/60"
                    data-focused-video
                  >
                    {focused.stream &&
                    focused.stream.getVideoTracks().some((t) => t.readyState === "live") ? (
                      <StableVideo
                        stream={focused.stream}
                        muted={focused.isLocal}
                        mirror={focused.isLocal && !focused.isScreen}
                        className="w-full h-full object-contain"
                      />
                    ) : focused.stoppedFrame ? (
                      <div className="relative w-full h-full">
                        <img
                          src={focused.stoppedFrame}
                          alt=""
                          className="w-full h-full object-contain blur-md brightness-75"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div
                            className="rounded-full overflow-hidden border-2 border-white/40 shadow-lg flex items-center justify-center text-white font-semibold"
                            style={{
                              width: "20%",
                              height: "20%",
                              minWidth: 48,
                              minHeight: 48,
                              background: focused.avatarColor || "var(--hq-accent)",
                            }}
                          >
                            {focused.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={focused.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">
                                {(focused.name || "?").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-white/50">
                        No video
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--hq-text)]">
                      {focused.name}
                      {focused.isLocal ? " (you)" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.querySelector("[data-focused-video]") as HTMLElement | null;
                        if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
                      }}
                      className="p-1 rounded text-[var(--hq-muted)] hover:text-[var(--hq-accent)]"
                      title="Browser fullscreen"
                    >
                      <Expand size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-[var(--hq-muted)]">
                  Select a screen
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="absolute bottom-4 left-4 text-xs text-[var(--hq-danger)] bg-[var(--hq-bg)]/90 px-2 py-1 rounded">
            {error}
          </p>
        )}
      </div>
    );
  }

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

      {showJoinLive && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--hq-accent)]/10 border border-[var(--hq-accent)]/30 px-3 py-3">
          <div className="w-10 h-10 rounded-full bg-[var(--hq-accent)]/20 flex items-center justify-center text-[var(--hq-accent)]">
            <PhoneCall size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Call in progress</p>
            <p className="text-xs text-[var(--hq-muted)]">Join anytime while the room is active</p>
          </div>
          <button
            type="button"
            onClick={acceptIncoming}
            className="px-3 py-1.5 rounded-full bg-[var(--hq-accent)] text-white text-xs font-medium hover:bg-[var(--hq-accent-hover)]"
          >
            Join
          </button>
        </div>
      )}

      <Toolbar />

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
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allTiles.map((tile) => (
            <ScreenCard
              key={tile.id}
              tile={tile}
              onFocus={() => {
                setFocusedPeerId(tile.id);
                setViewMode("sidebar");
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { playNotificationTone };
