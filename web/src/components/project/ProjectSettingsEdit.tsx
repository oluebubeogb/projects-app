"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check } from "lucide-react";

type Props = {
  projectId: string;
  title: string;
  description: string;
  visibility: "public" | "private";
  canEdit: boolean;
};

export function ProjectSettingsEdit({
  projectId,
  title: initialTitle,
  description: initialDescription,
  visibility: initialVisibility,
  canEdit,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [visibility, setVisibility] = useState<"public" | "private">(initialVisibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, title, description, visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setTitle(initialTitle);
          setDescription(initialDescription);
          setVisibility(initialVisibility);
          setError(null);
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--hq-border)] text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)] transition-colors"
        title="Edit project details"
      >
        <Pencil size={13} />
        Details
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-[var(--hq-border)] bg-[var(--hq-surface)] p-4 shadow-[var(--hq-shadow-md)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Project details</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-[var(--hq-muted)] hover:bg-[var(--hq-hover)]"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <form onSubmit={onSave} className="space-y-3">
            {error && (
              <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-600 dark:bg-red-900/20">
                {error}
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--hq-muted)]">Name</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-[var(--hq-border)] bg-[var(--hq-bg)] px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hq-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--hq-muted)]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-[var(--hq-border)] bg-[var(--hq-bg)] px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hq-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--hq-muted)]">Visibility</label>
              <div className="flex gap-2">
                {(["public", "private"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                      visibility === v
                        ? "border-[var(--hq-accent)] bg-[rgba(92,93,226,0.10)] text-[var(--hq-accent)]"
                        : "border-[var(--hq-border)] text-[var(--hq-muted)] hover:bg-[var(--hq-hover)]"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--hq-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--hq-accent-hover)] disabled:opacity-40"
            >
              <Check size={14} />
              {busy ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
