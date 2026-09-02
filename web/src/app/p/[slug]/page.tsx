import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, joinRequests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { ClientJoin } from "@/components/project/ClientJoin";
import { Pencil } from "lucide-react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

export default async function ProjectReadOnlyPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = (raw || "").trim();
  const user = await getSessionUser();

  if (!slug) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-xl font-bold mb-2">Project not found</h1>
        <Link href="/dashboard" className="text-[var(--hq-accent)] underline">
          Dashboard
        </Link>
      </div>
    );
  }

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  const project = rows[0];

  if (!project) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">Project not found</h1>
        <p className="text-sm text-[var(--hq-muted)] mb-4">
          No project with slug <code>{slug}</code>.
        </p>
        <Link href="/search" className="text-[var(--hq-accent)] underline">
          Search projects
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
    !!membership &&
    ["owner", "admin", "editor"].includes(membership.role);

  const canRead =
    project.visibility === "public" || !!membership;

  if (!canRead) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-xl font-bold mb-2">Private project</h1>
        <p className="text-sm text-[var(--hq-muted)] mb-4">
          You need access to view this project.
        </p>
        {!user ? (
          <Link
            href={`/login?next=/p/${encodeURIComponent(slug)}`}
            className="text-[var(--hq-accent)] underline"
          >
            Log in
          </Link>
        ) : (
          <ClientJoin projectId={project.id} pending={false} />
        )}
      </div>
    );
  }

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

  const editHref = `/open?slug=${encodeURIComponent(slug)}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
          {project.description ? (
            <p className="text-[var(--hq-muted)] mt-1">{project.description}</p>
          ) : null}
          <p className="text-xs text-[var(--hq-muted)] mt-2 capitalize">
            {project.visibility}
            {membership ? ` · ${membership.role}` : ""}
            {" · "}read-only
          </p>
        </div>
        <div className="flex gap-2 items-start">
          {canEdit && (
            <Link
              href={editHref}
              className="hq-btn hq-btn-primary text-sm inline-flex items-center gap-2"
              title="Open live editor"
            >
              <Pencil size={16} />
              Edit
            </Link>
          )}
          {user && !membership ? (
            <ClientJoin projectId={project.id} pending={pendingRequest} />
          ) : null}
        </div>
      </div>

      {project.latestSnapshotHtml ? (
        <div className="border border-[var(--hq-border)] rounded-[var(--hq-radius)] bg-[var(--hq-surface)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--hq-border)] text-xs text-[var(--hq-muted)] flex items-center justify-between bg-[var(--hq-sidebar)]">
            <span>Read-only · latest snapshot</span>
            {canEdit && (
              <Link
                href={editHref}
                className="text-[var(--hq-accent)] underline inline-flex items-center gap-1"
              >
                <Pencil size={12} />
                Edit live
              </Link>
            )}
            {!user && (
              <Link
                href={`/login?next=/p/${encodeURIComponent(slug)}`}
                className="text-[var(--hq-accent)] underline"
              >
                Log in
              </Link>
            )}
          </div>
          <div
            className="ProseMirror px-6 py-5"
            dangerouslySetInnerHTML={{ __html: project.latestSnapshotHtml }}
          />
        </div>
      ) : (
        <div className="border border-[var(--hq-border)] rounded-[var(--hq-radius)] p-6 bg-[var(--hq-surface)]">
          <p className="text-sm text-[var(--hq-muted)]">
            {canEdit
              ? "No published snapshot yet. Open the editor to write and commit a snapshot."
              : project.visibility === "public"
                ? "No published content yet."
                : "Nothing to show yet."}
          </p>
          {canEdit && (
            <Link
              href={editHref}
              className="hq-btn hq-btn-primary text-sm inline-flex items-center gap-2 mt-4"
            >
              <Pencil size={16} />
              Open editor
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
