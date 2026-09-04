import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { forums, forumMembers, forumPosts, users, projects } from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { ForumThread } from "@/components/forum/ForumThread";
import { MessageSquare, Lock, Globe } from "lucide-react";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function ForumDetailPage({ params }: Props) {
  await ensureMigrated();
  const { id } = await params;
  const session = await getSessionUser();
  const rows = await db.select({
    id: forums.id, title: forums.title, description: forums.description,
    visibility: forums.visibility, ownerId: forums.ownerId, projectId: forums.projectId,
    createdAt: forums.createdAt, updatedAt: forums.updatedAt,
    ownerName: users.name, ownerUsername: users.username,
  }).from(forums).innerJoin(users, eq(users.id, forums.ownerId)).where(eq(forums.id, id)).limit(1);
  const forum = rows[0];
  if (!forum) notFound();

  let isMember = false;
  if (session) {
    if (forum.ownerId === session.id) isMember = true;
    else {
      const mem = await db.select().from(forumMembers)
        .where(and(eq(forumMembers.forumId, id), eq(forumMembers.userId, session.id))).limit(1);
      isMember = !!mem[0];
    }
  }
  if (forum.visibility === "private" && !isMember) {
    if (!session) redirect(`/login?next=/forums/${id}`);
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Lock className="mx-auto text-[var(--hq-muted)] mb-3" size={28} />
        <h1 className="text-xl font-semibold mb-2">Private forum</h1>
        <p className="text-sm text-[var(--hq-muted)]">You need membership to view this forum.</p>
      </div>
    );
  }

  const posts = await db.select({
    id: forumPosts.id, body: forumPosts.body, kind: forumPosts.kind,
    mediaPath: forumPosts.mediaPath, parentId: forumPosts.parentId,
    createdAt: forumPosts.createdAt, authorId: forumPosts.authorId,
    authorName: users.name, authorUsername: users.username, authorColor: users.avatarColor,
  }).from(forumPosts).innerJoin(users, eq(users.id, forumPosts.authorId))
    .where(eq(forumPosts.forumId, id)).orderBy(asc(forumPosts.createdAt)).limit(200);

  let projectSlug: string | null = null;
  if (forum.projectId) {
    const p = await db.select({ slug: projects.slug }).from(projects).where(eq(projects.id, forum.projectId)).limit(1);
    projectSlug = p[0]?.slug || null;
  }
  const memberCount = await db.select({ cnt: sql<number>`count(*)::int` }).from(forumMembers).where(eq(forumMembers.forumId, id));
  const canPost = !!session && (forum.visibility === "public" || isMember);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--hq-accent)]/10 flex items-center justify-center shrink-0">
            <MessageSquare size={18} className="text-[var(--hq-accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{forum.title}</h1>
            {forum.description ? <p className="text-sm text-[var(--hq-muted)] mt-1">{forum.description}</p> : null}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[var(--hq-muted)]">
              <span className="inline-flex items-center gap-1">
                {forum.visibility === "private" ? <Lock size={11} /> : <Globe size={11} />}
                {forum.visibility}
              </span>
              <span>·</span>
              <Link href={`/u/${encodeURIComponent(forum.ownerUsername)}`} className="hover:text-[var(--hq-accent)]">@{forum.ownerUsername}</Link>
              <span>·</span>
              <span>{memberCount[0]?.cnt || 0} members</span>
              {projectSlug && (<>
                <span>·</span>
                <Link href={`/project/${encodeURIComponent(projectSlug)}`} className="text-[var(--hq-accent)] hover:underline">Linked project</Link>
              </>)}
            </div>
          </div>
        </div>
      </div>
      <ForumThread forumId={forum.id} initialPosts={posts} canPost={canPost} currentUserId={session?.id} />
    </div>
  );
}
