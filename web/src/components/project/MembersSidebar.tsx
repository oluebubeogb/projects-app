"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Link2, Shield, ChevronDown, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Member = { userId: string; name: string; username: string; color: string; role: string };
type LinkedForum = { id: string; title: string; visibility: string };
const ROLES = ["owner", "admin", "editor", "viewer"] as const;

export function MembersSidebar({
  projectId, members, canManage, linkedForumId: _initialLinked,
}: {
  projectId: string; members: Member[]; canManage: boolean; linkedForumId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [list, setList] = useState(members);
  const [msg, setMsg] = useState<string | null>(null);
  const [forums, setForums] = useState<LinkedForum[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creatingForum, setCreatingForum] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  async function loadForums() {
    try {
      const res = await fetch(`/api/forums?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setForums((data.forums || []).map((f: { id: string; title: string; visibility: string }) => ({
        id: f.id, title: f.title, visibility: f.visibility,
      })));
    } catch { /* ignore */ }
  }

  useEffect(() => { loadForums(); }, [projectId]);

  async function changeRole(userId: string, role: string) {
    if (!canManage || role === "owner") return;
    setBusy(userId); setMsg(null);
    try {
      const res = await fetch("/api/members/role", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, userId, role }),
      });
      if (res.ok) {
        setList((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
        setMsg("Role updated");
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error || "Failed");
      }
    } catch { setMsg("Network error"); }
    finally { setBusy(null); }
  }

  async function createLinkedForum(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !title.trim()) return;
    setCreatingForum(true); setMsg(null);
    try {
      const res = await fetch("/api/forums", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), visibility, projectId }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Failed to create forum"); return; }
      setMsg("Forum created"); setTitle(""); setDescription(""); setVisibility("public"); setShowCreate(false);
      await loadForums();
    } catch { setMsg("Network error"); }
    finally { setCreatingForum(false); }
  }

  return (
    <aside className="rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] shadow-[var(--hq-shadow)] overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[var(--hq-hover)] transition-colors">
        <span className="inline-flex items-center gap-2">
          <Users size={15} className="text-[var(--hq-accent)]" /> Members
          <span className="text-[var(--hq-muted)] font-normal">({list.length})</span>
        </span>
        <ChevronDown size={16} className={cn("text-[var(--hq-muted)] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-[var(--hq-border)] px-3 py-3 space-y-2">
          {list.map((m) => (
            <div key={m.userId} className="flex items-center gap-2.5 py-1.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ backgroundColor: m.color }}>
                {m.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${encodeURIComponent(m.username)}`} className="text-sm font-medium truncate block hover:text-[var(--hq-accent)]">{m.name}</Link>
                <p className="text-[11px] text-[var(--hq-muted)] truncate">@{m.username}</p>
              </div>
              {canManage && m.role !== "owner" ? (
                <select value={m.role} disabled={busy === m.userId} onChange={(e) => changeRole(m.userId, e.target.value)}
                  className="text-xs rounded-md border border-[var(--hq-border)] bg-[var(--hq-input-bg)] px-1.5 py-1 text-[var(--hq-text)]">
                  {ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span className="text-[11px] capitalize text-[var(--hq-muted)] inline-flex items-center gap-0.5">
                  {m.role === "owner" && <Shield size={10} />}{m.role}
                </span>
              )}
            </div>
          ))}
          {msg && <p className="text-xs text-[var(--hq-muted)] pt-1">{msg}</p>}
          <div className="pt-2 border-t border-[var(--hq-border)] mt-2 space-y-2">
            <p className="text-[11px] font-medium text-[var(--hq-muted)] mb-1.5 flex items-center gap-1"><Link2 size={11} /> Forums</p>
            {forums.length > 0 ? (
              <ul className="space-y-1.5">
                {forums.map((f) => (
                  <li key={f.id}>
                    <Link href={`/forums/${f.id}`} className="flex items-center gap-1.5 text-xs text-[var(--hq-accent)] hover:underline">
                      <MessageSquare size={12} /><span className="truncate">{f.title}</span>
                      <span className="text-[var(--hq-muted)]">({f.visibility})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-[var(--hq-muted)]">No forums linked yet.</p>}
            {canManage && (!showCreate ? (
              <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 text-xs text-[var(--hq-accent)] hover:underline">
                <Plus size={12} /> New forum
              </button>
            ) : (
              <form onSubmit={createLinkedForum} className="space-y-2 mt-1">
                <input className="hq-input text-xs py-1.5" placeholder="Forum title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
                <textarea className="hq-input text-xs py-1.5 min-h-[56px]" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                <select className="hq-input text-xs py-1.5" value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" disabled={creatingForum} className="text-xs px-2.5 py-1 rounded-md bg-[var(--hq-accent)] text-white disabled:opacity-50">
                    {creatingForum ? "Creating…" : "Create"}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-xs text-[var(--hq-muted)] hover:underline">Cancel</button>
                </div>
              </form>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
