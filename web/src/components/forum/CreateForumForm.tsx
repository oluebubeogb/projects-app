"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateForumForm({
  projectId,
  onCreated,
}: {
  projectId?: string;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/forums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, visibility, projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed");
        return;
      }
      onCreated?.(data.id);
      router.push(`/forums/${data.id}`);
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          className="hq-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          placeholder="Research discussion…"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          className="hq-input min-h-[72px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this forum for?"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Visibility</label>
        <select
          className="hq-input"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "public" | "private")}
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>
      {err && <p className="text-sm text-[var(--hq-danger)]">{err}</p>}
      <button type="submit" disabled={busy} className="hq-btn hq-btn-primary disabled:opacity-60">
        {busy ? "Creating…" : "Create forum"}
      </button>
    </form>
  );
}
