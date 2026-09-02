import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  projects,
  projectMembers,
  joinRequests,
  invites,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";
import { ClientJoin } from "@/components/project/ClientJoin";
import { AcceptInviteButton } from "@/components/project/AcceptInviteButton";
import { CopyLinkButton } from "@/components/project/CopyLinkButton";
import { Pencil } from "lucide-react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
};

export default async function ProjectReadOnlyPage({
  params,
  searchParams,
}: Props) {
  const { slug: raw } = await params;
  const sp = await searchParams;
  const slug = (raw || "").trim();
  const inviteToken = (sp.invite || "").trim();
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

  const canRead = project.visibility === "public" || !!membership;

  // Pending invite for this user (by token query or by email match)
  let pendingInvite: typeof invites.$inferSelect | null = null;
  if (user && !membership) {
    if (inviteToken) {
      const inv = await db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.token, inviteToken),
            eq(invites.projectId, project.id),
            isNull(invites.acceptedAt)
          )
        )
        .limit(1);
      if (inv[0] && inv[0].email.toLowerCase() === user.email.toLowerCase()) {
        pendingInvite = inv[0];
      }
    }
    if (!pendingInvite) {
      const inv = await db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.projectId, project.id),
            eq(invites.email, user.email.toLowerCase()),
            isNull(invites.acceptedAt)
          )
        )
        .limit(1);
      pendingInvite = inv[0] ?? null;
    }
  }

  if (!canRead && !pendingInvite) {
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
  if (user && !membership && !pendingInvite) {
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

  // Collaborators for avatars
  const memberRows = await db
    .select({
      name: users.name,
      color: projectMembers.color,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, project.id))
    .limit(12);

  const editHref = `/open?slug=${encodeURIComponent(slug)}`;
  const shortPath = `/p/${encodeURIComponent(slug)}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
        {project.description ? (
          <p className="text-[var(--hq-muted)] mt-1">{project.description}</p>
        ) : null}
      </div>

      {/* Line 1: status bar */}
      <div className="border border-[var(--hq-border)] rounded-[var(--hq-radius)] bg-[var(--hq-surface)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--hq-border)] text-xs text-[var(--hq-muted)] flex flex-wrap items-center gap-2 justify-between bg-[var(--hq-sidebar)]">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Read-only · latest snapshot</span>
            {pendingInvite && (
              <AcceptInviteButton token={pendingInvite.token} />
            )}
            {!user && (
              <Link
                href={`/login?next=/p/${encodeURIComponent(slug)}`}
                className="text-[var(--hq-accent)] underline"
              >
                Log in to edit
              </Link>
            )}
            {user && !membership && !pendingInvite && (
              <ClientJoin projectId={project.id} pending={pendingRequest} />
            )}
          </div>

          <div className="flex items-center gap-2">
            <CopyLinkButton path={shortPath} />
            {/* Collaborators */}
            <div className="flex items-center -space-x-1.5">
              {memberRows.map((m, i) => (
                <span
                  key={`${m.name}-${i}`}
                  title={`${m.name} (${m.role})`}
                  className="w-6 h-6 rounded-full text-[10px] flex items-center justify-center text-white font-bold ring-2 ring-[var(--hq-sidebar)]"
                  style={{ backgroundColor: m.color }}
                >
                  {m.name[0]?.toUpperCase()}
                </span>
              ))}
            </div>
            {canEdit && (
              <Link
                href={editHref}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hq-accent)]/15 text-[var(--hq-accent)] hover:bg-[var(--hq-accent)]/25 transition-colors"
                title="Open live editor"
              >
                <Pencil size={13} />
                Edit
              </Link>
            )}
          </div>
        </div>

        {project.latestSnapshotHtml ? (
          <div
            className="ProseMirror px-6 py-5"
            dangerouslySetInnerHTML={{ __html: project.latestSnapshotHtml }}
          />
        ) : (
          <div className="p-6">
            <p className="text-sm text-[var(--hq-muted)]">
              {canEdit
                ? "No published snapshot yet. Open the editor to write and commit a snapshot."
                : "No published content yet."}
            </p>
            {canEdit && (
              <Link
                href={editHref}
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-[var(--hq-accent)] underline"
              >
                <Pencil size={14} />
                Open editor
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
