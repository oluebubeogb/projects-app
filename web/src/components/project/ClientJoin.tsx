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
      <span className="px-3 py-1.5 text-sm rounded-lg bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
        Request pending
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={requestJoin}
        disabled={loading}
        className="px-3 py-1.5 text-sm rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] disabled:opacity-60 transition-colors"
      >
        {loading ? "Sending…" : "Request to join"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
