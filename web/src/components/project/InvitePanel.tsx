"use client";

import { useState } from "react";
import { X, Mail, Check, UserRound } from "lucide-react";

export function InvitePanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [suggestions, setSuggestions] = useState<{ id: string; username: string; name: string }[]>([]);
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchUsers(value: string) {
    setIdentifier(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/invites?projectId=${encodeURIComponent(projectId)}&q=${encodeURIComponent(value.trim())}`);
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.users || []);
    } catch {
      setSuggestions([]);
    }
  }

  async function send() {
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, identifier, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSent(true);
      setIdentifier("");
      setSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md hq-card shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hq-border)]">
          <h2 className="font-semibold flex items-center gap-2">
            <Mail size={18} /> Invite collaborator
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--hq-hover)]">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--hq-success)]/15 text-[var(--hq-success)] flex items-center justify-center">
                <Check size={20} />
              </div>
              <p className="text-sm font-medium">Invite sent</p>
              <p className="text-xs text-[var(--hq-muted)] max-w-xs">
                They&apos;ll get a notification. When they open the project they can accept and start collaborating.
              </p>
              <button
                type="button"
                className="hq-btn hq-btn-ghost text-sm mt-2"
                onClick={() => setSent(false)}
              >
                Invite another
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <label className="text-xs text-[var(--hq-muted)] block mb-1">Email or username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--hq-muted)]">
                    {identifier.trim().startsWith("@") ? <UserRound size={15} /> : <Mail size={15} />}
                  </span>
                  <input
                    type="text"
                    className="hq-input pl-9"
                    value={identifier}
                    onChange={(e) => searchUsers(e.target.value)}
                    placeholder="email@example.com or @username"
                    autoComplete="off"
                    onKeyDown={(e) => e.key === "Enter" && identifier.trim() && send()}
                  />
                </div>
                {suggestions.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 overflow-hidden rounded-lg border border-[var(--hq-border)] bg-[var(--hq-surface)] shadow-lg">
                    {suggestions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--hq-hover)]"
                        onClick={() => { setIdentifier(`@${u.username}`); setSuggestions([]); }}
                      >
                        <span className="w-8 h-8 rounded-full bg-[var(--hq-accent)]/10 text-[var(--hq-accent)] flex items-center justify-center text-xs font-semibold">
                          {u.name?.[0]?.toUpperCase() || "U"}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm truncate">{u.name}</span>
                          <span className="block text-xs text-[var(--hq-muted)] truncate">@{u.username}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-[var(--hq-muted)] block mb-1">Role</label>
                <select
                  className="hq-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button
                type="button"
                disabled={loading || !identifier.trim()}
                onClick={send}
                className="hq-btn hq-btn-primary w-full disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send invite"}
              </button>
              {error && <p className="text-xs text-[var(--hq-danger)]">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
