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
  const [err, setErr] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function submit(kind: "text" | "voice" = "text", mediaPath?: string) {
    if (kind === "text" && !body.trim()) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/forums/${forumId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim() || (kind === "voice" ? "Voice note" : ""),
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

  async function toggleRecord() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Stub: in production upload to media API and pass path
        // For now post as voice with placeholder path
        const fakePath = `voice-stub-${Date.now()}.webm`;
        await submit("voice", fakePath);
        void blob;
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setErr("Microphone unavailable");
    }
  }

  return (
    <div className="border border-[var(--hq-border)] rounded-[var(--hq-radius)] bg-[var(--hq-surface)] p-3">
      <textarea
        className="hq-input min-h-[80px] resize-y mb-2"
        placeholder="Write a reply… Support for voice notes below."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={sending}
      />
      <div className="flex items-center gap-2">
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
          onClick={toggleRecord}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-[var(--hq-border)] ${
            recording ? "bg-[var(--hq-danger)]/15 text-[var(--hq-danger)]" : ""
          }`}
        >
          {recording ? <Square size={14} /> : <Mic size={14} />}
          {recording ? "Stop & send" : "Voice note"}
        </button>
        {err && <span className="text-xs text-[var(--hq-danger)]">{err}</span>}
      </div>
    </div>
  );
}
