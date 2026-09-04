"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type N = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: number | null;
  createdAt: number;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setUnread(0);
    setItems((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || Math.floor(Date.now() / 1000) }))
    );
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: Math.floor(Date.now() / 1000) } : n
      )
    );
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative p-1.5 rounded-md text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)] transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--hq-danger)] text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden hq-card shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--hq-border)]">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs text-[var(--hq-accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <p className="text-xs text-[var(--hq-muted)] p-4">No notifications</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-3 py-2.5 border-b border-[var(--hq-border)] last:border-0 hover:bg-[var(--hq-hover)]",
                    !n.readAt && "bg-[var(--hq-accent)]/5"
                  )}
                >
                  {n.link ? (
                    <Link
                      href={n.link}
                      onClick={() => {
                        markOne(n.id);
                        setOpen(false);
                      }}
                      className="block"
                    >
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.body ? (
                        <div className="text-xs text-[var(--hq-muted)] mt-0.5 line-clamp-2">
                          {n.body}
                        </div>
                      ) : null}
                      <div className="text-[10px] text-[var(--hq-muted)] mt-1">
                        {new Date(n.createdAt * 1000).toLocaleString()}
                      </div>
                    </Link>
                  ) : (
                    <button type="button" className="block w-full text-left" onClick={() => markOne(n.id)}>
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.body ? (
                        <div className="text-xs text-[var(--hq-muted)] mt-0.5">{n.body}</div>
                      ) : null}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
