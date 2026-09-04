"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type P = {
  id: string;
  slug: string;
  title: string;
  visibility: string;
  description: string;
  updatedAt: number;
};

function ProjectsInner() {
  const sp = useSearchParams();
  const vis = sp.get("vis");
  const [projects, setProjects] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        let list: P[] = d.projects || [];
        if (vis) list = list.filter((p) => p.visibility === vis);
        setProjects(list);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [vis]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Projects</h1>
      {loading ? (
        <p className="text-sm text-[var(--hq-muted)]">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-[var(--hq-muted)]">
          No projects in your memberships.
        </p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/open?slug=${encodeURIComponent(p.slug)}`}
              className="hq-card p-4 flex items-center justify-between hover:border-[var(--hq-accent)] transition-colors block"
            >
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-[var(--hq-muted)] mt-0.5">
                  /{p.slug} · {p.visibility}
                </div>
              </div>
              <span className="text-xs text-[var(--hq-muted)]">
                {new Date(p.updatedAt * 1000).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--hq-muted)]">Loading…</p>}>
      <ProjectsInner />
    </Suspense>
  );
}
