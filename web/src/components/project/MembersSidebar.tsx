"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Link2, Shield, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Member = {
  userId: string;
  name: string;
  username: string;
  color: string;
  role: string;
};

const ROLES = ["owner", "admin", "editor", "viewer"] as const;

export function MembersSidebar({
  projectId,
  members,
  canManage,
  linkedForumId: initialLinked,
}: {
  projectId: string;
  members: Member[];
  canManage: boolean;
  linkedForumId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [list, setList] = useState(members);
  const [msg, setMsg] = useState<string | null>(null);
  const [linkedForumId, setLinkedForumId] = useState<string | null>(
    initialLinked || null
  );
  const [creatingForum, setCreatingForum] = useState(false);

  useEffect(() => {
    // Load forums linked to this project
    (async () => {
      try {
        const res = await fetch(`/api/forums?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.forums?.[0]?.id) setLinkedForumId(data.forums[0].id);
      } catch {
        /* ignore */
      }
    })();
  }, [projectId]);

  async function changeRole(userId: string, role: string) {
    if (!canManage || role === "owner") return;
    setBusy(userId);
    setMsg(null);
    try {
      const res = await fetch("/api/members/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, userId, role }),
      });
      if (res.ok) {
        setList((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, role } : m))
        );
        setMsg("Role updated");
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error || "Failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function createLinkedForum() {
    if (!canManage) return;
    setCreatingForum(true);
    setMsg(null);
    try {
      const res = await fetch("/api/forums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Project forum",
          description: "Discussion linked to this project",
          visibility: "public",
          projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Failed to create forum");
        return;
      }
      setLinkedForumId(data.id);
      setMsg("Forum linked");
    } catch {
      setMsg("Network error");
    } finally {
      setCreatingForum(false);
    }
  }

  return (
    <aside className="rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] shadow-[var(--hq-shadow)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[var(--hq-hover)] transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <Users size={15} className="text-[var(--hq-accent)]" />
          Members
          <span className="text-[var(--hq-muted)] font-normal">({list.length})</span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-[var(--hq-muted)] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--hq-border)] px-3 py-3 space-y-2">
          {list.map((m) => (
            <div key={m.userId} className="flex items-center gap-2.5 py-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ backgroundColor: m.color }}
              >
                {m.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${encodeURIComponent(m.username)}`}
                  className="text-sm font-medium truncate block hover:text-[var(--hq-accent)]"
                >
                  {m.name}
                </Link>
                <p className="text-[11px] text-[var(--hq-muted)] truncate">
                  @{m.username}
                </p>
              </div>
              {canManage && m.role !== "owner" ? (
                <select
                  value={m.role}
                  disabled={busy === m.userId}
                  onChange={(e) => changeRole(m.userId, e.target.value)}
                  className="text-xs rounded-md border border-[var(--hq-border)] bg-[var(--hq-input-bg)] px-1.5 py-1 text-[var(--hq-text)]"
                >
                  {ROLES.filter((r) => r !== "owner").map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] capitalize text-[var(--hq-muted)] inline-flex items-center gap-0.5">
                  {m.role === "owner" && <Shield size={10} />}
                  {m.role}
                </span>
              )}
            </div>
          ))}

          {msg && <p className="text-xs text-[var(--hq-muted)] pt-1">{msg}</p>}

          <div className="pt-2 border-t border-[var(--hq-border)] mt-2">
            <p className="text-[11px] font-medium text-[var(--hq-muted)] mb-1.5 flex items-center gap-1">
              <Link2 size={11} /> Forum
            </p>
            {linkedForumId ? (
              <Link
                href={`/forums/${linkedForumId}`}
                className="text-xs text-[var(--hq-accent)] hover:underline"
              >
                Open linked forum
              </Link>
            ) : canManage ? (
              <button
                type="button"
                onClick={createLinkedForum}
                disabled={creatingForum}
                className="inline-flex items-center gap-1 text-xs text-[var(--hq-accent)] hover:underline disabled:opacity-50"
              >
                <Plus size={12} />
                {creatingForum ? "Creating…" : "Create & link forum"}
              </button>
            ) : (
              <p className="text-xs text-[var(--hq-muted)]">No forum linked.</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
