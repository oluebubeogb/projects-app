import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { forums, forumMembers, users } from "@/lib/db/schema";
import { eq, desc, or, sql } from "drizzle-orm";
import { CreateForumForm } from "@/components/forum/CreateForumForm";
import { MessageSquare, Plus, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ForumsPage() {
  await ensureMigrated();
  const user = await getSessionUser();

  const rows = await db
    .select({
      id: forums.id,
      title: forums.title,
      description: forums.description,
      visibility: forums.visibility,
      projectId: forums.projectId,
      updatedAt: forums.updatedAt,
      ownerName: users.name,
      ownerUsername: users.username,
    })
    .from(forums)
    .innerJoin(users, eq(users.id, forums.ownerId))
    .where(
      user
        ? or(eq(forums.visibility, "public"), eq(forums.ownerId, user.id))
        : eq(forums.visibility, "public")
    )
    .orderBy(desc(forums.updatedAt))
    .limit(40);

  const counts: Record<string, number> = {};
  for (const r of rows) {
    const c = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(forumMembers)
      .where(eq(forumMembers.forumId, r.id));
    counts[r.id] = c[0]?.cnt || 0;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forums</h1>
          <p className="text-sm text-[var(--hq-muted)] mt-1">
            Project-linked discussions with posts, voice notes, and calls.
          </p>
        </div>
      </div>

      {user && (
        <details className="mb-8 group">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--hq-accent)] text-white text-sm font-medium hover:bg-[var(--hq-accent-hover)]">
            <Plus size={16} />
            New forum
          </summary>
          <div className="mt-4 p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] max-w-lg">
            <CreateForumForm />
          </div>
        </details>
      )}

      {rows.length === 0 ? (
        <div className="rounded-[var(--hq-radius)] border border-dashed border-[var(--hq-border)] p-12 text-center bg-[var(--hq-surface)]/50">
          <Users size={28} className="mx-auto text-[var(--hq-muted)] mb-3" />
          <p className="text-[var(--hq-muted)] text-sm max-w-md mx-auto">
            No forums yet. Create one, or link a forum from a project sidebar.
          </p>
          {!user && (
            <Link href="/login" className="inline-block mt-4 text-sm text-[var(--hq-accent)] underline">
              Log in to get started
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((f) => (
            <Link
              key={f.id}
              href={`/forums/${f.id}`}
              className="block p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors shadow-[var(--hq-shadow)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-medium flex items-center gap-2">
                    <MessageSquare size={15} className="text-[var(--hq-accent)] shrink-0" />
                    {f.title}
                  </h2>
                  {f.description ? (
                    <p className="text-sm text-[var(--hq-muted)] mt-1 line-clamp-2">
                      {f.description}
                    </p>
                  ) : null}
                  <p className="text-xs text-[var(--hq-muted)] mt-2">
                    by @{f.ownerUsername} · {f.visibility}
                    {f.projectId ? " · linked to project" : ""}
                  </p>
                </div>
                <div className="text-xs text-[var(--hq-muted)] text-right shrink-0">
                  <div>{counts[f.id] || 0} members</div>
                  <div>{new Date(f.updatedAt * 1000).toLocaleDateString()}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
