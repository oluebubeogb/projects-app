"use client";

import { useState, useRef } from "react";
import { Mic, Send, Square } from "lucide-react";

export function ForumComposer({
  forumId,
  onPosted,
}: {
  forumId: string;
  onPosted: (post: Record<string, unknown>) => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreview, setVoicePreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function submit(kind: "text" | "voice" = "text", mediaPath?: string, textOverride?: string) {
    const text = (textOverride ?? body).trim();
    if (kind === "text" && !text) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/forums/${forumId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text || (kind === "voice" ? "Voice note" : ""),
          kind,
          mediaPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed");
        return;
      }
      onPosted(data);
      setBody("");
    } catch {
      setErr("Network error");
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (voicePreview) {
      URL.revokeObjectURL(voicePreview.url);
      setVoicePreview(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setVoicePreview({ blob, url });
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setErr("Microphone unavailable");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function sendVoicePreview() {
    if (!voicePreview) return;
    setSending(true);
    setErr(null);
    try {
      const file = new File([voicePreview.blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("forumId", forumId);
      const up = await fetch("/api/messages/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok) {
        setErr(upData.error || "Upload failed");
        return;
      }
      URL.revokeObjectURL(voicePreview.url);
      setVoicePreview(null);
      await submit("voice", upData.path, "Voice note");
    } catch {
      setErr("Upload failed");
    } finally {
      setSending(false);
    }
  }

  function discardVoicePreview() {
    if (voicePreview) URL.revokeObjectURL(voicePreview.url);
    setVoicePreview(null);
  }

  return (
    <div className="border border-[var(--hq-border)] rounded-[var(--hq-radius)] bg-[var(--hq-surface)] p-3">
      <textarea
        className="hq-input min-h-[80px] resize-y mb-2"
        placeholder="Write a reply… Support for voice notes below."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={sending || recording}
      />
      <div className="flex items-center gap-2 flex-wrap">
        {recording ? (
          <>
            <span className="flex items-center gap-2 text-sm text-red-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Recording {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-red-500 text-white"
            >
              <Square size={14} />
              Stop
            </button>
          </>
        ) : voicePreview ? (
          <>
            <audio controls src={voicePreview.url} className="h-9 max-w-[220px]" />
            <button
              type="button"
              onClick={discardVoicePreview}
              className="px-2.5 py-1.5 rounded-md text-xs border border-[var(--hq-border)] text-[var(--hq-muted)]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={sendVoicePreview}
              disabled={sending}
              className="hq-btn hq-btn-primary text-xs py-1.5 disabled:opacity-50"
            >
              <Send size={14} />
              Send voice
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => submit("text")}
              disabled={sending || !body.trim()}
              className="hq-btn hq-btn-primary text-xs py-1.5 disabled:opacity-50"
            >
              <Send size={14} />
              Post
            </button>
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-[var(--hq-border)]"
            >
              <Mic size={14} />
              Voice note
            </button>
          </>
        )}
        {err && <span className="text-xs text-[var(--hq-danger)]">{err}</span>}
      </div>
    </div>
  );
}
