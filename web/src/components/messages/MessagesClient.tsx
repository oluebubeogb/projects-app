"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CallPanel } from "@/components/webrtc/CallPanel";
import {
  Mic,
  Send,
  Image as ImageIcon,
  Paperclip,
  Smile,
  FileText,
  Music,
  Download,
  Search,
  ChevronLeft,
} from "lucide-react";

type Peer = {
  userId: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarUrl?: string | null;
};

type Conv = {
  id: string;
  kind: string;
  title: string;
  updatedAt: number;
  lastReadAt?: number | null;
  peers: Peer[];
  lastMessage: { body: string; kind: string; createdAt: number; authorId?: string } | null;
};

type Msg = {
  id: string;
  body: string;
  kind: string;
  mediaPath?: string | null;
  createdAt: number;
  authorId: string;
  authorName: string;
  authorColor?: string;
};

const STICKERS = ["😀", "😂", "🥰", "😎", "🤔", "🙌", "🔥", "💯", "🚀", "✨", "❤️", "👍", "🎉", "👀", "💪", "🌟"];

function Avatar({ peer, size = 32 }: { peer: { name: string; avatarColor: string; avatarUrl?: string | null }; size?: number }) {
  if (peer.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={peer.avatarUrl}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: peer.avatarColor, fontSize: size * 0.4 }}
    >
      {peer.name[0]?.toUpperCase() || "?"}
    </div>
  );
}

function playSoftChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.35);
  } catch {}
}

export function MessagesClient({
  initialTo,
  myId,
}: {
  initialTo?: string;
  myId: string;
}) {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/messages");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations || []);
  }, []);

  const loadMessages = useCallback(async (id: string, silent = false) => {
    const res = await fetch(`/api/messages/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const list: Msg[] = data.messages || [];
    setMessages((prev) => {
      if (silent && prev.length && list.length > prev.length) {
        const newest = list[list.length - 1];
        if (newest && newest.authorId !== myId && newest.id !== lastMsgIdRef.current) {
          playSoftChime();
        }
      }
      if (list.length) lastMsgIdRef.current = list[list.length - 1].id;
      return list;
    });
    if (!silent) {
      fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      }).catch(() => {});
    }
  }, [myId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!initialTo) return;
    (async () => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: initialTo }),
      });
      const data = await res.json();
      if (res.ok && data.conversationId) {
        setActiveId(data.conversationId);
        await loadConversations();
        await loadMessages(data.conversationId);
      }
    })();
  }, [initialTo, loadConversations, loadMessages]);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
      const iv = setInterval(() => {
        loadMessages(activeId, true);
        loadConversations();
      }, 2200);
      return () => clearInterval(iv);
    }
  }, [activeId, loadMessages, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(body?: string, kind = "text", mediaPath?: string) {
    if (!activeId) return;
    const payloadBody = body ?? text.trim();
    if (!payloadBody && !mediaPath) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/messages/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: payloadBody || "", kind, mediaPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          body: data.body,
          kind: data.kind || kind,
          mediaPath: data.mediaPath || mediaPath,
          createdAt: data.createdAt,
          authorId: data.authorId,
          authorName: data.authorName,
        },
      ]);
      if (!body) setText("");
      setShowStickers(false);
      loadConversations();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndSend(file: File, asImage = false) {
    if (!activeId) return;
    if (!asImage && file.size > 5 * 1024 * 1024) {
      setErr("File must be under 5 MB");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conversationId", activeId);
      if (asImage) fd.append("convert", "webp");
      const res = await fetch("/api/messages/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Upload failed");
        return;
      }
      await send(data.originalName || file.name, data.kind || (asImage ? "image" : "file"), data.path);
    } catch {
      setErr("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        await uploadAndSend(file);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    }).catch(() => setErr("Microphone access denied"));
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const active = conversations.find((c) => c.id === activeId);
  const peer = active?.peers[0];

  const filteredMessages = search.trim()
    ? messages.filter(
        (m) =>
          m.body.toLowerCase().includes(search.trim().toLowerCase()) ||
          (m.authorName || "").toLowerCase().includes(search.trim().toLowerCase())
      )
    : messages;

  const mediaItems = messages.filter((m) => m.mediaPath || m.kind === "image" || m.kind === "file" || m.kind === "voice");

  function unreadCount(c: Conv) {
    if (!c.lastMessage) return 0;
    if (c.lastMessage.authorId === myId) return 0;
    const lastRead = c.lastReadAt ?? 0;
    return c.lastMessage.createdAt > lastRead ? 1 : 0;
  }

  const totalUnread = conversations.reduce((n, c) => n + unreadCount(c), 0);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("messages-unread", { detail: { count: totalUnread } }));
  }, [totalUnread]);

  return (
    <div className="grid md:grid-cols-[minmax(260px,32%)_1fr] gap-0 md:gap-4 min-h-[70vh] rounded-[var(--hq-radius)] overflow-hidden border border-[var(--hq-border)] bg-[var(--hq-surface)]">
      <aside className={`flex flex-col border-r border-[var(--hq-border)] ${activeId ? "hidden md:flex" : "flex"}`}>
        <div className="sticky top-0 z-10 px-3 py-3 border-b border-[var(--hq-border)] bg-[var(--hq-surface)]/95 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--hq-muted)]">
            Conversations
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--hq-accent)] text-white text-[10px] font-bold">
                {totalUnread}
              </span>
            )}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="p-4 text-xs text-[var(--hq-muted)]">
              No conversations yet. Message someone from their profile.
            </p>
          )}
          {conversations.map((c) => {
            const label = c.peers.map((p) => p.name).join(", ") || c.title || "Chat";
            const p = c.peers[0];
            const unread = unreadCount(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveId(c.id);
                  setShowMedia(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-3 border-b border-[var(--hq-border)]/60 hover:bg-[var(--hq-hover)] transition-colors flex items-center gap-3 ${
                  activeId === c.id ? "bg-[var(--hq-hover)]" : ""
                }`}
              >
                {p ? <Avatar peer={p} size={40} /> : (
                  <div className="w-10 h-10 rounded-full bg-[var(--hq-bg)] flex items-center justify-center text-xs text-[var(--hq-muted)]">?</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${unread ? "font-semibold" : "font-medium"}`}>{label}</p>
                    {unread > 0 && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-[var(--hq-accent)]" />
                    )}
                  </div>
                  {c.lastMessage && (
                    <p className="text-[11px] text-[var(--hq-muted)] truncate mt-0.5">
                      {c.lastMessage.kind === "voice"
                        ? "🎤 Voice note"
                        : c.lastMessage.kind === "image"
                        ? "📷 Photo"
                        : c.lastMessage.kind === "file"
                        ? "📎 File"
                        : c.lastMessage.body}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className={`flex flex-col min-h-[50vh] ${!activeId ? "hidden md:flex" : "flex"}`}>
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-[var(--hq-muted)]">
            Select a conversation or start one from a profile.
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-20 px-3 py-2.5 border-b border-[var(--hq-border)] bg-[var(--hq-surface)]/95 backdrop-blur-sm flex items-center gap-3">
              <button
                type="button"
                className="md:hidden p-1.5 rounded-lg hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
                onClick={() => setActiveId(null)}
              >
                <ChevronLeft size={18} />
              </button>
              {peer && (
                <Link href={`/u/${encodeURIComponent(peer.username)}`} className="shrink-0">
                  <Avatar peer={peer} size={36} />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">
                  {active?.peers.map((p) => (
                    <Link
                      key={p.userId}
                      href={`/u/${encodeURIComponent(p.username)}`}
                      className="hover:text-[var(--hq-accent)]"
                    >
                      {p.name}
                    </Link>
                  ))}
                </p>
                <p className="text-[11px] text-[var(--hq-muted)] truncate">
                  @{peer?.username}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Shared media"
                  onClick={() => setShowMedia((v) => !v)}
                  className={`p-2 rounded-lg transition-colors ${
                    showMedia ? "bg-[var(--hq-accent)]/15 text-[var(--hq-accent)]" : "text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)]"
                  }`}
                >
                  <ImageIcon size={18} />
                </button>
                <div className="hidden sm:block">
                  <CallPanel kind="dm" contextId={activeId} compact />
                </div>
              </div>
            </div>

            <div className="px-3 pt-2 pb-1 border-b border-[var(--hq-border)]/50">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--hq-muted)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversation…"
                  className="w-full bg-[var(--hq-bg)] text-sm py-2 pl-8 pr-3 rounded-lg border border-transparent focus:border-[var(--hq-accent)] focus:outline-none placeholder:text-[var(--hq-muted-2)]"
                />
              </div>
            </div>

            <div className="sm:hidden px-3 pt-2">
              <CallPanel kind="dm" contextId={activeId} />
            </div>

            {showMedia ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Shared media & files</h3>
                  <button type="button" onClick={() => setShowMedia(false)} className="text-xs text-[var(--hq-muted)] hover:text-[var(--hq-text)]">
                    Back to chat
                  </button>
                </div>
                {mediaItems.length === 0 ? (
                  <p className="text-sm text-[var(--hq-muted)]">No media shared yet.</p>
                ) : (
                  <div className="space-y-6">
                    {(["image", "voice", "file"] as const).map((group) => {
                      const items = mediaItems.filter((m) =>
                        group === "image"
                          ? m.kind === "image" || (m.mediaPath && /\.(webp|jpg|jpeg|png|gif)$/i.test(m.mediaPath))
                          : group === "voice"
                          ? m.kind === "voice"
                          : m.kind === "file" || (m.mediaPath && !/\.(webp|jpg|jpeg|png|gif|webm|mp3|ogg)$/i.test(m.mediaPath || ""))
                      );
                      if (!items.length) return null;
                      return (
                        <div key={group}>
                          <p className="text-xs font-medium uppercase tracking-wider text-[var(--hq-muted)] mb-2 flex items-center gap-1.5">
                            {group === "image" && <ImageIcon size={12} />}
                            {group === "voice" && <Music size={12} />}
                            {group === "file" && <FileText size={12} />}
                            {group === "image" ? "Photos" : group === "voice" ? "Voice notes" : "Files"}
                          </p>
                          <div className={group === "image" ? "grid grid-cols-3 sm:grid-cols-4 gap-2" : "space-y-2"}>
                            {items.map((m) => (
                              <div key={m.id} className="rounded-lg border border-[var(--hq-border)] bg-[var(--hq-bg)] overflow-hidden">
                                {group === "image" && m.mediaPath ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <a href={m.mediaPath} target="_blank" rel="noreferrer">
                                    <img src={m.mediaPath} alt="" className="w-full aspect-square object-cover" />
                                  </a>
                                ) : (
                                  <div className="p-3 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-[var(--hq-surface)] flex items-center justify-center text-[var(--hq-muted)]">
                                      {group === "voice" ? <Mic size={16} /> : <FileText size={16} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium truncate">{m.body || "Attachment"}</p>
                                      <p className="text-[10px] text-[var(--hq-muted)]">
                                        {new Date(m.createdAt * 1000).toLocaleString()}
                                      </p>
                                    </div>
                                    {m.mediaPath && (
                                      <a href={m.mediaPath} download className="p-1.5 rounded hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]">
                                        <Download size={14} />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                {filteredMessages.map((m) => {
                  const mine = m.authorId === myId;
                  const isLink = /^https?:\/\//i.test(m.body.trim());
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-[var(--hq-accent)] text-white rounded-br-md"
                            : "bg-[var(--hq-bg)] border border-[var(--hq-border)] rounded-bl-md"
                        }`}
                      >
                        {m.kind === "voice" && (
                          <div className="flex items-center gap-2 mb-1">
                            <Mic size={14} className="opacity-80" />
                            <span className="text-xs opacity-90">Voice note</span>
                            {m.mediaPath && (
                              <audio controls src={m.mediaPath} className="h-8 max-w-[180px]" />
                            )}
                          </div>
                        )}
                        {(m.kind === "image" || (m.mediaPath && /\.(webp|jpg|jpeg|png|gif)$/i.test(m.mediaPath))) && m.mediaPath && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a href={m.mediaPath} target="_blank" rel="noreferrer" className="block mb-1">
                            <img src={m.mediaPath} alt="" className="max-w-full max-h-64 rounded-lg object-contain" />
                          </a>
                        )}
                        {m.kind === "file" && m.mediaPath && (
                          <a
                            href={m.mediaPath}
                            download
                            className={`inline-flex items-center gap-2 text-xs mb-1 underline ${mine ? "text-white/90" : "text-[var(--hq-accent)]"}`}
                          >
                            <Paperclip size={12} />
                            {m.body || "Download file"}
                          </a>
                        )}
                        {m.body && m.kind !== "voice" && (
                          isLink ? (
                            <a
                              href={m.body.trim()}
                              target="_blank"
                              rel="noreferrer"
                              className={`underline break-all ${mine ? "text-white" : "text-[var(--hq-accent)]"}`}
                            >
                              {m.body}
                            </a>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          )
                        )}
                        <p className={`text-[10px] mt-1 ${mine ? "text-white/65" : "text-[var(--hq-muted)]"}`}>
                          {new Date(m.createdAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {!showMedia && (
              <div className="border-t border-[var(--hq-border)] bg-[var(--hq-surface)] p-2.5">
                {showStickers && (
                  <div className="mb-2 p-2 rounded-xl bg-[var(--hq-bg)] border border-[var(--hq-border)] flex flex-wrap gap-1.5">
                    {STICKERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="text-2xl hover:scale-125 transition-transform p-0.5"
                        onClick={() => send(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {recording ? (
                  <div className="flex items-center gap-3 px-2 py-2">
                    <span className="flex items-center gap-2 text-sm text-red-500 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      Recording {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="ml-auto px-4 py-1.5 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                    >
                      Stop & send
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end gap-1.5">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Stickers"
                        onClick={() => setShowStickers((v) => !v)}
                        className="p-2 rounded-xl text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)] transition-colors"
                      >
                        <Smile size={20} />
                      </button>
                      <button
                        type="button"
                        title="Photo"
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 rounded-xl text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)] transition-colors"
                      >
                        <ImageIcon size={20} />
                      </button>
                      <button
                        type="button"
                        title="File (max 5 MB)"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-xl text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)] transition-colors"
                      >
                        <Paperclip size={20} />
                      </button>
                      <button
                        type="button"
                        title="Voice note"
                        onClick={startRecording}
                        className="p-2 rounded-xl text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)] transition-colors"
                      >
                        <Mic size={20} />
                      </button>
                    </div>
                    <div className="flex-1 relative">
                      <textarea
                        className="w-full resize-none hq-input min-h-[42px] max-h-28 py-2.5 pr-11 text-sm leading-snug"
                        placeholder="Message… (links auto-detected)"
                        value={text}
                        rows={1}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        disabled={busy}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => send()}
                      disabled={busy || !text.trim()}
                      className="p-2.5 rounded-xl bg-[var(--hq-accent)] text-white disabled:opacity-40 hover:bg-[var(--hq-accent-hover)] transition-colors shrink-0"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAndSend(f, true);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAndSend(f, false);
                    e.target.value = "";
                  }}
                />
                {err && <p className="mt-1.5 text-xs text-[var(--hq-danger)] px-1">{err}</p>}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
