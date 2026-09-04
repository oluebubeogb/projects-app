"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pending = {
  id: string;
  name: string;
  userId: string;
};

export function PendingJoinBanner({ requests }: { requests: Pending[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [list, setList] = useState(requests);

  if (!list.length) return null;

  async function act(requestId: string, action: "approve" | "reject") {
    setBusy(requestId);
    try {
      const res = await fetch("/api/join-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed");
        return;
      }
      setList((prev) => prev.filter((r) => r.id !== requestId));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {list.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs bg-[var(--hq-warning)]/10 border border-[var(--hq-warning)]/30"
        >
          <span className="font-medium text-[var(--hq-text)]">{r.name}</span>
          <span className="text-[var(--hq-muted)]">wants to join</span>
          <button
            type="button"
            disabled={busy === r.id}
            onClick={() => act(r.id, "approve")}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--hq-success)]/15 text-[var(--hq-success)] hover:bg-[var(--hq-success)]/25 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy === r.id}
            onClick={() => act(r.id, "reject")}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--hq-danger)]/15 text-[var(--hq-danger)] hover:bg-[var(--hq-danger)]/25 disabled:opacity-50"
          >
            Decline
          </button>
        </span>
      ))}
    </div>
  );
}
