"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  name: string;
  username: string;
  bio: string;
  organization: string;
  location: string;
  avatarColor: string;
  avatarUrl: string;
};

const COLORS = [
  "#5C5DE2",
  "#20A653",
  "#447AA6",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#0891B2",
  "#BE185D",
];

export function ProfileEditForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Failed to save");
        return;
      }
      setMsg("Profile updated");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">Display name</label>
        <input
          className="hq-input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Username</label>
        <input
          className="hq-input"
          value={form.username}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
            }))
          }
          required
          minLength={5}
          maxLength={32}
          pattern="[a-z0-9_-]{5,32}"
        />
        <p className="text-xs text-[var(--hq-muted)] mt-1">
          Letters, numbers, - and _. Min 5 characters.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Bio</label>
        <textarea
          className="hq-input min-h-[100px] resize-y"
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          maxLength={500}
          placeholder="Research interests, role, or a short introduction…"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Organization</label>
        <input
          className="hq-input"
          value={form.organization}
          onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
          maxLength={120}
          placeholder="University, lab, or company"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Location</label>
        <input
          className="hq-input"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          maxLength={120}
          placeholder="City, country"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Avatar color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((f) => ({ ...f, avatarColor: c }))}
              className="w-8 h-8 rounded-full border-2 transition"
              style={{
                backgroundColor: c,
                borderColor: form.avatarColor === c ? "var(--hq-text)" : "transparent",
              }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Profile picture URL</label>
        <input
          className="hq-input"
          value={form.avatarUrl}
          onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
          placeholder="https://… (optional)"
        />
        <p className="text-xs text-[var(--hq-muted)] mt-1">
          Prefer a square image. Uploaded media uses WebP where possible.
        </p>
      </div>

      {err && <p className="text-sm text-[var(--hq-danger)]">{err}</p>}
      {msg && <p className="text-sm text-[var(--hq-success)]">{msg}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="hq-btn hq-btn-primary disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <a href={`/u/${encodeURIComponent(form.username)}`} className="hq-btn hq-btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}
