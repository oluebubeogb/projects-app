"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function accept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.refresh();
      if (data.project?.slug) {
        router.push(`/open?slug=${encodeURIComponent(data.project.slug)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={accept}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hq-success)]/15 text-[var(--hq-success)] hover:bg-[var(--hq-success)]/25 transition-colors disabled:opacity-50"
      >
        {loading ? "Accepting…" : "Accept invitation to collaborate"}
      </button>
      {error && <span className="text-[var(--hq-danger)]">{error}</span>}
    </span>
  );
}
