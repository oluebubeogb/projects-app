"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClientJoin({
  projectId,
  pending,
}: {
  projectId: string;
  pending: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(pending);
  const [error, setError] = useState("");

  async function requestJoin() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hq-warning)]/15 text-[var(--hq-warning)]">
        Request pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={requestJoin}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hq-success)]/15 text-[var(--hq-success)] hover:bg-[var(--hq-success)]/25 transition-colors disabled:opacity-50"
      >
        {loading ? "Sending…" : "Join this project"}
      </button>
      {error && <span className="text-[var(--hq-danger)] text-xs">{error}</span>}
    </span>
  );
}
