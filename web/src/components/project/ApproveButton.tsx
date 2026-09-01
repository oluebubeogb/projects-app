"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "approve" | "reject") {
    setLoading(true);
    try {
      const res = await fetch("/api/join-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        disabled={loading}
        onClick={() => act("approve")}
        className="px-2.5 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => act("reject")}
        className="px-2.5 py-1 text-xs rounded-md border border-[var(--hq-border)] hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
