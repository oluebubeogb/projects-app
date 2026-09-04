"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";

function InviteAcceptInner() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const [projectSlug, setProjectSlug] = useState<string | null>(null);

  async function accept() {
    if (!token) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("ok");
      setProjectSlug(data.project?.slug || null);
      if (data.project?.slug) {
        setTimeout(() => {
          router.push(`/open?slug=${encodeURIComponent(data.project.slug)}`);
        }, 1200);
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">Invalid invite</h1>
        <p className="text-sm text-[var(--hq-muted)]">Missing token.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="hq-card p-6">
        <h1 className="text-xl font-bold mb-2">Accept invitation</h1>
        <p className="text-sm text-[var(--hq-muted)] mb-6">
          You need to be logged in with the invited email address.
        </p>

        {status === "ok" ? (
          <p className="text-[var(--hq-success)] text-sm">
            Joined! {projectSlug ? "Redirecting…" : ""}
          </p>
        ) : (
          <button
            type="button"
            onClick={accept}
            disabled={status === "loading"}
            className="hq-btn hq-btn-primary w-full disabled:opacity-50"
          >
            {status === "loading" ? "Accepting…" : "Accept invite"}
          </button>
        )}

        {error && (
          <p className="text-sm text-[var(--hq-danger)] mt-3">
            {error}
            {error.includes("Unauthorized") || error.toLowerCase().includes("log") ? (
              <>
                {" "}
                <Link
                  href={`/login?next=/invite?token=${encodeURIComponent(token)}`}
                  className="underline"
                >
                  Log in
                </Link>
              </>
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-[var(--hq-muted)]">Loading…</div>}>
      <InviteAcceptInner />
    </Suspense>
  );
}
