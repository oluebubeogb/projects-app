"use client";

import { useState } from "react";
import { X, Mail, Check } from "lucide-react";

export function InvitePanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSent(true);
      setEmail("");
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
              <div>
                <label className="text-xs text-[var(--hq-muted)] block mb-1">Email</label>
                <input
                  type="email"
                  className="hq-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  onKeyDown={(e) => e.key === "Enter" && email.trim() && send()}
                />
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
                disabled={loading || !email.trim()}
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
