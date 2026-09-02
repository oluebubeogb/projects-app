"use client";

import { useState } from "react";
import { X, Mail } from "lucide-react";

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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setLoading(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setInviteUrl(data.invite.inviteUrl);
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
            <Mail size={18} /> Invite by email
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--hq-hover)]">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-[var(--hq-muted)] block mb-1">Email</label>
            <input
              type="email"
              className="hq-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
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
            {loading ? "Creating…" : "Create invite link"}
          </button>
          {error && <p className="text-xs text-[var(--hq-danger)]">{error}</p>}
          {inviteUrl && (
            <div className="p-3 rounded-md bg-[var(--hq-input-bg)] border border-[var(--hq-border)]">
              <p className="text-xs text-[var(--hq-muted)] mb-1">
                Share this link (recipient must log in with that email):
              </p>
              <code className="text-xs break-all text-[var(--hq-accent)]">{inviteUrl}</code>
              <button
                type="button"
                className="mt-2 text-xs text-[var(--hq-accent)] underline"
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
              >
                Copy link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
