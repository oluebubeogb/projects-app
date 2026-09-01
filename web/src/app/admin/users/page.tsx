"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type U = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarColor: string;
  createdAt: number;
};

function UsersInner() {
  const sp = useSearchParams();
  const roleFilter = sp.get("role");
  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        let list: U[] = d.users || [];
        if (roleFilter === "admin") list = list.filter((u) => u.role === "admin");
        setUsers(list);
      })
      .finally(() => setLoading(false));
  }, [roleFilter]);

  async function setRole(userId: string, role: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Users</h1>
      {loading ? (
        <p className="text-sm text-[var(--hq-muted)]">Loading…</p>
      ) : (
        <div className="hq-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--hq-border)] text-left text-xs text-[var(--hq-muted)]">
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--hq-border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: u.avatarColor }}
                      >
                        {u.name[0]?.toUpperCase()}
                      </span>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-[var(--hq-muted)]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.role === "admin"
                          ? "text-[var(--hq-accent)] text-xs font-medium"
                          : "text-[var(--hq-muted)] text-xs"
                      }
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--hq-muted)]">
                    {new Date(u.createdAt * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role === "admin" ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--hq-muted)] hover:text-[var(--hq-text)]"
                        onClick={() => setRole(u.id, "user")}
                      >
                        Demote
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-[var(--hq-accent)] hover:underline"
                        onClick={() => setRole(u.id, "admin")}
                      >
                        Make admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--hq-muted)]">Loading…</p>}>
      <UsersInner />
    </Suspense>
  );
}
