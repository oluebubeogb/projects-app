"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  users: number;
  projects: number;
  members: number;
  media: number;
  commits: number;
  ftsReady: boolean;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d.stats);
      })
      .catch(() => setError("Failed to load stats"));
  }, []);

  const cards = stats
    ? [
        { label: "Users", value: stats.users, href: "/admin/users" },
        { label: "Projects", value: stats.projects, href: "/admin/projects" },
        { label: "Memberships", value: stats.members, href: "/admin/projects" },
        { label: "Media files", value: stats.media, href: "/admin/media" },
        { label: "Commits", value: stats.commits, href: "/admin/projects" },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Overview</h1>
      <p className="text-sm text-[var(--hq-muted)] mb-6">
        Platform health and activity
      </p>

      {error && (
        <p className="text-sm text-[var(--hq-danger)] mb-4">{error}</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {stats
          ? cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="hq-card p-4 hover:border-[var(--hq-accent)] transition-colors"
              >
                <div className="text-2xl font-bold tabular-nums">{c.value}</div>
                <div className="text-xs text-[var(--hq-muted)] mt-1">{c.label}</div>
              </Link>
            ))
          : Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="hq-card p-4 h-20 animate-pulse bg-[var(--hq-hover)]" />
            ))}
      </div>

      <div className="hq-card p-4">
        <h2 className="font-semibold mb-2">Search engine</h2>
        <p className="text-sm text-[var(--hq-muted)]">
          Full-text search:{" "}
          <span
            className={
              stats?.ftsReady
                ? "text-[var(--hq-success)]"
                : "text-[var(--hq-warning)]"
            }
          >
            {stats?.ftsReady ? "FTS5 active" : "FTS5 not ready"}
          </span>
        </p>
        <p className="text-xs text-[var(--hq-muted)] mt-2">
          SQLite FTS5 indexes public project title, description, and body for ranked search.
          Postgres path can be enabled later via <code>DATABASE_URL</code>.
        </p>
      </div>
    </div>
  );
}
