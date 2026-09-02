"use client";

import { useEffect, useState } from "react";
import { X, GitCommit } from "lucide-react";

type CommitRow = {
  id: string;
  message: string;
  plainText: string | null;
  html: string | null;
  createdAt: string | number | Date;
  authorName: string;
  authorColor: string;
};

export function CommitHistory({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [commits, setCommits] = useState<CommitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Update");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CommitRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/commits?projectId=${encodeURIComponent(projectId)}`);
        const data = await res.json();
        if (!cancelled) setCommits(data.commits || []);
      } catch {
        if (!cancelled) setError("Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function createCommit() {
    setSaving(true);
    setError(null);
    try {
      // Grab plain text from the live editor if possible
      const prose = document.querySelector(".ProseMirror");
      const plainText = prose?.textContent || "";
      const html = prose?.innerHTML || "";

      const res = await fetch("/api/commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message, plainText, html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCommits((prev) => [
        {
          id: data.commit.id,
          message: data.commit.message,
          plainText,
          html,
          createdAt: data.commit.createdAt,
          authorName: data.commit.authorName,
          authorColor: "#22c55e",
        },
        ...prev,
      ]);
      setMessage("Update");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function formatTime(ts: number | string | Date) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col hq-card shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hq-border)]">
          <h2 className="font-semibold flex items-center gap-2">
            <GitCommit size={18} /> Commit history
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--hq-hover)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--hq-border)] space-y-2">
          <input
            className="hq-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message"
          />
          <button
            type="button"
            onClick={createCommit}
            disabled={saving || !message.trim()}
            className="hq-btn hq-btn-primary w-full disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create commit (snapshot)"}
          </button>
          {error && <p className="text-xs text-[var(--hq-danger)]">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-sm text-[var(--hq-muted)] p-4">Loading…</p>
          ) : commits.length === 0 ? (
            <p className="text-sm text-[var(--hq-muted)] p-4">No commits yet.</p>
          ) : (
            <ul className="space-y-1">
              {commits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[var(--hq-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.authorColor }}
                      />
                      <span className="font-medium text-sm truncate">{c.message}</span>
                    </div>
                    <div className="text-xs text-[var(--hq-muted)] mt-0.5 pl-4">
                      {c.authorName} · {formatTime(c.createdAt)}
                    </div>
                  </button>
                  {selected?.id === c.id && c.plainText && (
                    <pre className="mx-3 mb-2 p-3 text-xs bg-[var(--hq-input-bg)] border border-[var(--hq-border)] rounded-md overflow-auto max-h-40 whitespace-pre-wrap">
                      {c.plainText.slice(0, 2000)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
