"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

export function ForumsNav({ className = "" }: { className?: string }) {
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.count === "number") setBadge(detail.count);
    };
    window.addEventListener("forums-unread", handler);

    const load = async () => {
      try {
        const res = await fetch("/api/forums");
        if (!res.ok) return;
        const data = await res.json();
        const list = data.forums || [];
        let n = 0;
        for (const f of list) {
          if (!f.lastPostAt) continue;
          if (f.lastPostAuthorId && f.lastReadAt != null && f.lastPostAt > f.lastReadAt) n++;
          else if (f.lastPostAt && f.lastReadAt == null) n++;
        }
        setBadge(n);
        window.dispatchEvent(new CustomEvent("forums-unread", { detail: { count: n } }));
      } catch {}
    };
    load();
    const iv = setInterval(load, 20000);
    return () => {
      window.removeEventListener("forums-unread", handler);
      clearInterval(iv);
    };
  }, []);

  return (
    <Link
      href="/forums"
      className={`relative group inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--hq-muted)] hover:text-[var(--hq-text)] hover:bg-[var(--hq-hover)] transition-colors ${className}`}
      aria-label="Forums"
    >
      <MessagesSquare size={18} />
      {badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--hq-accent)] text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="pointer-events-none absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--hq-elevated)] border border-[var(--hq-border)] px-2 py-1 text-[11px] text-[var(--hq-text)] opacity-0 group-hover:opacity-100 transition-opacity shadow-[var(--hq-shadow-md)] z-50">
        Forums
      </span>
    </Link>
  );
}
