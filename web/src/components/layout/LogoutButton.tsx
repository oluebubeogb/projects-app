"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally { setBusy(false); }
  }
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={className || "text-[var(--hq-muted)] hover:text-[var(--hq-danger)] transition-colors text-sm disabled:opacity-50"}>
      {busy ? "Logging out…" : "Logout"}
    </button>
  );
}
