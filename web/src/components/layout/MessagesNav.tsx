"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function MessagesNav({ className = "" }: { className?: string }) {
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.count === "number") setBadge(detail.count);
    };
    window.addEventListener("messages-unread", handler);
    // also poll lightly
    const load = async () => {
      try {
        const res = await fetch("/api/messages");
        if (!res.ok) return;
        const data = await res.json();
        const list = data.conversations || [];
        let n = 0;
        for (const c of list) {
          if (c.lastMessage && c.lastMessage.authorId && c.lastReadAt != null) {
            if (c.lastMessage.createdAt > (c.lastReadAt || 0)) n++;
          } else if (c.lastMessage && !c.lastReadAt) n++;
        }
        setBadge(n);
      } catch {}
    };
    load();
    const iv = setInterval(load, 15000);
    return () => {
      window.removeEventListener("messages-unread", handler);
      clearInterval(iv);
    };
  }, []);

  return (
    <Link
      href="/messages"
      className={`relative group inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--hq-muted)] hover:text-[var(--hq-text)] hover:bg-[var(--hq-hover)] transition-colors ${className}`}
      aria-label="Messages"
    >
      <MessageCircle size={18} />
      {badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--hq-accent)] text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="pointer-events-none absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--hq-elevated)] border border-[var(--hq-border)] px-2 py-1 text-[11px] text-[var(--hq-text)] opacity-0 group-hover:opacity-100 transition-opacity shadow-[var(--hq-shadow-md)] z-50">
        Messages
      </span>
    </Link>
  );
}
