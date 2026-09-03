"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, Suspense } from "react";
import { Search } from "lucide-react";

function HeaderSearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [, startTransition] = useTransition();
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    startTransition(() => router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search"));
  }
  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--hq-muted)] pointer-events-none" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, forums, people…"
        className="w-full h-9 pl-9 pr-3 rounded-full border border-[var(--hq-border)] bg-[var(--hq-input-bg)] text-sm text-[var(--hq-text)] placeholder:text-[var(--hq-muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--hq-accent)]/30 focus:border-[var(--hq-accent)] transition" />
    </form>
  );
}
export function HeaderSearch() {
  return (
    <Suspense fallback={<div className="h-9 w-full rounded-full border border-[var(--hq-border)] bg-[var(--hq-input-bg)]" />}>
      <HeaderSearchInner />
    </Suspense>
  );
}
