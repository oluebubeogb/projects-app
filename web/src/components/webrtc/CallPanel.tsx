"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Monitor, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** dm | forum | project */
  kind?: "dm" | "forum" | "project";
  contextId?: string;
  className?: string;
};

/**
 * WebRTC voice + screen-share stub.
 * Uses browser getUserMedia / getDisplayMedia and a simple HTTP signaling channel.
 * Replace signaling with Redis/WebSocket for multi-instance production.
 */
export function CallPanel({ kind = "dm", contextId, className }: Props) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sinceRef = useRef(0);
  const isHostRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  async function ensurePc() {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.onicecandidate = (e) => {
      if (e.candidate && roomId) {
        fetch(`/api/calls/${roomId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "ice", payload: e.candidate }),
        }).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function getLocalStream(video: boolean) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: 640, height: 480 } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }

  function startPolling(rid: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/calls/${rid}/signal?since=${sinceRef.current}`
        );
        if (!res.ok) return;
        const data = await res.json();
        sinceRef.current = data.serverTime || Date.now();
        for (const s of data.signals || []) {
          await handleSignal(s);
        }
      } catch {
        /* ignore poll errors */
      }
    }, 1200);
  }

  async function handleSignal(s: {
    from: string;
    type: string;
    payload: unknown;
  }) {
    const pc = await ensurePc();
    if (s.type === "offer" && !isHostRef.current) {
      await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetch(`/api/calls/${roomId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "answer", payload: answer }),
      });
      setStatus("live");
    } else if (s.type === "answer" && isHostRef.current) {
      await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
      setStatus("live");
    } else if (s.type === "ice") {
      try {
        await pc.addIceCandidate(s.payload as RTCIceCandidateInit);
      } catch {
        /* ignore */
      }
    } else if (s.type === "hangup") {
      endCall(false);
    }
  }

  async function startCall() {
    setError(null);
    setStatus("connecting");
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, contextId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");
      setRoomId(data.id);
      isHostRef.current = true;

      const stream = await getLocalStream(camOn);
      const pc = await ensurePc();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch(`/api/calls/${data.id}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "offer", payload: offer }),
      });
      startPolling(data.id);
      setStatus("live");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Call failed");
      cleanup();
    }
  }

  async function joinExisting(rid: string) {
    setError(null);
    setStatus("connecting");
    setRoomId(rid);
    isHostRef.current = false;
    try {
      const stream = await getLocalStream(camOn);
      const pc = await ensurePc();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await fetch(`/api/calls/${rid}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "join", payload: { user: true } }),
      });
      startPolling(rid);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Join failed");
      cleanup();
    }
  }

  async function endCall(notify = true) {
    if (notify && roomId) {
      fetch(`/api/calls/${roomId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hangup", payload: null }),
      }).catch(() => {});
    }
    cleanup();
    setRoomId(null);
    setStatus("idle");
    setSharing(false);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }

  async function toggleScreen() {
    if (sharing) {
      // stop screen tracks, keep mic
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const pc = pcRef.current;
      const track = display.getVideoTracks()[0];
      if (pc && track) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
        else pc.addTrack(track, display);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = display;
      }
      track.onended = () => setSharing(false);
      setSharing(true);
    } catch {
      setError("Screen share denied or unavailable");
    }
  }

  return (
    <div
      className={cn(
        "rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] p-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-[var(--hq-muted)]">
          Voice / screen
          {status === "live" && (
            <span className="ml-2 text-[var(--hq-success)]">· Live</span>
          )}
          {status === "connecting" && (
            <span className="ml-2 text-[var(--hq-warning)]">· Connecting…</span>
          )}
        </p>
        <div className="flex items-center gap-1">
          {status === "idle" || status === "error" ? (
            <button
              type="button"
              onClick={startCall}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hq-success)] text-white hover:opacity-90"
            >
              <Phone size={12} />
              Start call
            </button>
          ) : (
            <button
              type="button"
              onClick={() => endCall(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hq-danger)] text-white hover:opacity-90"
            >
              <PhoneOff size={12} />
              End
            </button>
          )}
        </div>
      </div>

      {(status === "live" || status === "connecting") && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video rounded-md bg-black/80 object-cover"
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full aspect-video rounded-md bg-black/80 object-cover"
          />
        </div>
      )}

      {(status === "live" || status === "connecting") && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-[var(--hq-border)]",
              muted && "bg-[var(--hq-danger)]/15 text-[var(--hq-danger)]"
            )}
          >
            {muted ? <MicOff size={12} /> : <Mic size={12} />}
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => setCamOn((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-[var(--hq-border)]"
            title="Camera preference applies on next call"
          >
            {camOn ? <Video size={12} /> : <VideoOff size={12} />}
            Cam
          </button>
          <button
            type="button"
            onClick={toggleScreen}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-[var(--hq-border)]",
              sharing && "bg-[var(--hq-accent)]/15 text-[var(--hq-accent)]"
            )}
          >
            <Monitor size={12} />
            {sharing ? "Stop share" : "Share screen"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--hq-danger)] mt-2">{error}</p>
      )}
      <p className="text-[10px] text-[var(--hq-muted)] mt-2">
        Stub signaling over HTTP · STUN only · Works for 1:1 local tests.
        Production should use TURN + Redis pub/sub.
      </p>
    </div>
  );
}
