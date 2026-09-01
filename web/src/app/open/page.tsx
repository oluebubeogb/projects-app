import { getSessionUser, createCollabToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, joinRequests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import path from "path";
import { ProjectEditor } from "@/components/project/ProjectEditor";
import { ClientJoin } from "@/components/project/ClientJoin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Props = { searchParams: Promise<{ slug?: string }> };

export default async function OpenProjectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const slug = (sp.slug || "").trim();
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const user = await getSessionUser();

  if (!slug) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-xl font-bold mb-2">Open project</h1>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Missing <code>?slug=</code> query.
        </p>
        <Link href="/dashboard" className="text-[var(--primary)] underline">
          Dashboard
        </Link>
      </div>
    );
  }

  console.log(`[open] slug="${slug}" dataDir=${dataDir}`);

  let project: typeof projects.$inferSelect | undefined;
  let allSlugs: { slug: string; title: string }[] = [];
  let err: string | null = null;

  try {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    project = rows[0];
    allSlugs = await db
      .select({ slug: projects.slug, title: projects.title })
      .from(projects)
      .limit(50);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  if (!project) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">Project not found</h1>
        <pre className="text-xs p-4 rounded-lg border overflow-auto bg-[var(--bg-elevated)]">
          {JSON.stringify({ slug, dataDir, err, allSlugs }, null, 2)}
        </pre>
        <Link
          href="/api/debug/db?key=projects-debug"
          className="text-sm text-[var(--primary)] underline mt-4 inline-block"
        >
          Diagnostics
        </Link>
      </div>
    );
  }

  let membership: typeof projectMembers.$inferSelect | null = null;
  if (user) {
    const m = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.userId, user.id)
        )
      )
      .limit(1);
    membership = m[0] ?? null;
  }

  const canEdit =
    membership &&
    ["owner", "admin", "editor"].includes(membership.role);

  let pendingRequest = false;
  if (user && !membership) {
    const req = await db
      .select()
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.projectId, project.id),
          eq(joinRequests.userId, user.id),
          eq(joinRequests.status, "pending")
        )
      )
      .limit(1);
    pendingRequest = req.length > 0;
  }

  let collabToken: string | null = null;
  let collabUser: { id: string; name: string; color: string } | null = null;
  if (user && canEdit) {
    collabToken = await createCollabToken(user.id);
    collabUser = {
      id: user.id,
      name: user.name,
      color: membership!.color || user.avatarColor,
    };
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {project.description ? (
            <p className="text-[var(--text-muted)] mt-1">{project.description}</p>
          ) : null}
          <p className="text-xs text-[var(--text-muted)] mt-2 capitalize">
            {project.visibility}
            {membership ? ` · ${membership.role}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {user && !membership ? (
            <ClientJoin projectId={project.id} pending={pendingRequest} />
          ) : null}
        </div>
      </div>

      {canEdit && collabToken && collabUser ? (
        <div className="h-[min(70vh,640px)]">
          <ProjectEditor
            projectId={project.id}
            token={collabToken}
            user={collabUser}
          />
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--bg-elevated)]">
          <p className="text-sm text-[var(--text-muted)]">
            {user
              ? "You need editor access to collaborate live."
              : "Log in to edit."}
          </p>
          {!user ? (
            <Link
              href={`/login?next=/open?slug=${encodeURIComponent(slug)}`}
              className="text-sm text-[var(--primary)] underline mt-2 inline-block"
            >
              Log in
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
