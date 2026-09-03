"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CallPanel } from "@/components/webrtc/CallPanel";
import { Mic, Send } from "lucide-react";

type Peer = {
  userId: string;
  name: string;
  username: string;
  avatarColor: string;
};

type Conv = {
  id: string;
  kind: string;
  title: string;
  updatedAt: number;
  peers: Peer[];
  lastMessage: { body: string; kind: string; createdAt: number } | null;
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

  async function loadConversations() {
    const res = await fetch("/api/messages");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations || []);
  }

  async function loadMessages(id: string) {
    const res = await fetch(`/api/messages/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
  }

  useEffect(() => {
    loadConversations();
  }, []);

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
  }, [initialTo]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  async function send() {
    if (!activeId || !text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/messages/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
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
          kind: data.kind,
          createdAt: data.createdAt,
          authorId: data.authorId,
          authorName: data.authorName,
        },
      ]);
      setText("");
      loadConversations();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 min-h-[60vh]">
      <aside className="rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--hq-border)] text-xs font-medium text-[var(--hq-muted)]">
          Conversations
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {conversations.length === 0 && (
            <p className="p-4 text-xs text-[var(--hq-muted)]">
              No conversations. Message someone from their profile.
            </p>
          )}
          {conversations.map((c) => {
            const label =
              c.peers.map((p) => p.name).join(", ") || c.title || "Chat";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-[var(--hq-border)] hover:bg-[var(--hq-hover)] transition-colors ${
                  activeId === c.id ? "bg-[var(--hq-hover)]" : ""
                }`}
              >
                <p className="text-sm font-medium truncate">{label}</p>
                {c.lastMessage && (
                  <p className="text-[11px] text-[var(--hq-muted)] truncate mt-0.5">
                    {c.lastMessage.kind === "voice" ? "Voice note" : c.lastMessage.body}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] flex flex-col min-h-[50vh]">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-[var(--hq-muted)]">
            Select a conversation or start one from a profile.
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-[var(--hq-border)] flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">
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
              </div>
            </div>

            <div className="px-4 pt-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-sm py-2 border-0 border-b border-[var(--hq-border)] focus:outline-none focus:border-[var(--hq-accent)] placeholder:text-[var(--hq-muted-2)]"
              />
            </div>

            <div className="px-3 pt-3">
              <CallPanel kind="dm" contextId={activeId} />
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {(search.trim() ? messages.filter((m) => m.authorId === myId && m.body.toLowerCase().includes(search.trim().toLowerCase())) : messages).map((m) => {
                const mine = m.authorId === myId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "bg-[var(--hq-accent)] text-white"
                          : "bg-[var(--hq-bg)] border border-[var(--hq-border)]"
                      }`}
                    >
                      {m.kind === "voice" && (
                        <span className="inline-flex items-center gap-1 text-xs opacity-80 mb-1">
                          <Mic size={11} /> Voice
                        </span>
                      )}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          mine ? "text-white/70" : "text-[var(--hq-muted)]"
                        }`}
                      >
                        {new Date(m.createdAt * 1000).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-[var(--hq-border)] flex gap-2">
              <input
                className="hq-input flex-1"
                placeholder="Write a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={busy}
              />
              <button
                type="button"
                onClick={send}
                disabled={busy || !text.trim()}
                className="hq-btn hq-btn-primary disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
            {err && <p className="px-3 pb-2 text-xs text-[var(--hq-danger)]">{err}</p>}
          </>
        )}
      </section>
    </div>
  );
}
