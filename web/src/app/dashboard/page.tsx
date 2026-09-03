import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { projects, projectMembers, forums, forumMembers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { MessageSquare } from "lucide-react";
import { LogoutButton } from "@/components/layout/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureMigrated();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const memberships = await db.select({ project: projects, role: projectMembers.role })
    .from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id)).orderBy(desc(projects.updatedAt));

  const myForums = await db.select({
    id: forums.id, title: forums.title, description: forums.description,
    visibility: forums.visibility, updatedAt: forums.updatedAt,
  }).from(forumMembers).innerJoin(forums, eq(forumMembers.forumId, forums.id))
    .where(eq(forumMembers.userId, user.id)).orderBy(desc(forums.updatedAt)).limit(20);

  const ownedForums = await db.select({
    id: forums.id, title: forums.title, description: forums.description,
    visibility: forums.visibility, updatedAt: forums.updatedAt,
  }).from(forums).where(eq(forums.ownerId, user.id)).orderBy(desc(forums.updatedAt)).limit(20);

  const seen = new Set<string>();
  const forumList = [...myForums, ...ownedForums].filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Your projects</h1>
        <p className="text-sm text-[var(--hq-muted)] mt-1">Welcome back, {user.name}</p>
        <div className="mt-2"><LogoutButton /></div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/dashboard/new" className="text-[var(--hq-accent)] hover:underline font-medium">New project</Link>
          <span className="text-[var(--hq-border)]">|</span>
          <Link href="/settings/profile" className="text-[var(--hq-accent)] hover:underline font-medium">Edit profile</Link>
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--hq-border)] rounded-[var(--hq-radius)] bg-[var(--hq-surface)]/60">
          <p className="text-[var(--hq-muted)] mb-4">You don&apos;t have any projects yet.</p>
          <Link href="/dashboard/new" className="text-[var(--hq-accent)] font-medium hover:underline">Create your first project →</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberships.map(({ project, role }) => (
            <Link key={project.id} href={`/project/${encodeURIComponent(project.slug)}`}
              className="block p-5 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors shadow-[var(--shadow)]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-semibold line-clamp-1">{project.title}</h2>
                <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${
                  project.visibility === "private" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                }`}>{project.visibility}</span>
              </div>
              <p className="text-sm text-[var(--hq-muted)] line-clamp-2 mb-3">{project.description || "No description"}</p>
              <p className="text-xs text-[var(--hq-muted)] capitalize">{role}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare size={18} className="text-[var(--hq-accent)]" /> Your forums
          </h2>
          <Link href="/forums" className="text-sm text-[var(--hq-accent)] hover:underline">Browse all</Link>
        </div>
        {forumList.length === 0 ? (
          <p className="text-sm text-[var(--hq-muted)] py-6 border border-dashed border-[var(--hq-border)] rounded-[var(--hq-radius)] text-center">
            You haven&apos;t joined any forums yet.{" "}
            <Link href="/forums" className="text-[var(--hq-accent)] hover:underline">Explore forums</Link>
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {forumList.map((f) => (
              <Link key={f.id} href={`/forums/${f.id}`}
                className="block p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm line-clamp-1">{f.title}</h3>
                  <span className="text-[10px] uppercase text-[var(--hq-muted)]">{f.visibility}</span>
                </div>
                {f.description ? <p className="text-xs text-[var(--hq-muted)] mt-1 line-clamp-2">{f.description}</p> : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
