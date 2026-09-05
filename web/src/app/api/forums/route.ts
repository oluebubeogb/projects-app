import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { forums, forumMembers, forumPosts, projects, projectMembers, users } from "@/lib/db/schema";
import { eq, desc, or, and, sql } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const rows = await db
    .select({
      id: forums.id,
      title: forums.title,
      description: forums.description,
      visibility: forums.visibility,
      ownerId: forums.ownerId,
      projectId: forums.projectId,
      createdAt: forums.createdAt,
      updatedAt: forums.updatedAt,
      ownerName: users.name,
      ownerUsername: users.username,
    })
    .from(forums)
    .innerJoin(users, eq(users.id, forums.ownerId))
    .where(
      projectId
        ? eq(forums.projectId, projectId)
        : session
          ? or(eq(forums.visibility, "public"), eq(forums.ownerId, session.id))
          : eq(forums.visibility, "public")
    )
    .orderBy(desc(forums.updatedAt))
    .limit(50);

  let filtered = rows;
  if (q) {
    const ql = q.toLowerCase();
    filtered = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(ql) ||
        (r.description || "").toLowerCase().includes(ql)
    );
  }

  // member counts
  const counts: Record<string, number> = {};
  for (const r of filtered) {
    const c = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(forumMembers)
      .where(eq(forumMembers.forumId, r.id));
    counts[r.id] = c[0]?.cnt || 0;
  }

  // last post + lastReadAt for unread badges
  const extras: Record<string, { lastPostAt: number | null; lastPostAuthorId: string | null; lastReadAt: number | null }> = {};
  for (const r of filtered) {
    const last = await db
      .select({ createdAt: forumPosts.createdAt, authorId: forumPosts.authorId })
      .from(forumPosts)
      .where(eq(forumPosts.forumId, r.id))
      .orderBy(desc(forumPosts.createdAt))
      .limit(1);
    let lastReadAt: number | null = null;
    if (session) {
      const mem = await db
        .select({ lastReadAt: forumMembers.lastReadAt })
        .from(forumMembers)
        .where(and(eq(forumMembers.forumId, r.id), eq(forumMembers.userId, session.id)))
        .limit(1);
      lastReadAt = mem[0]?.lastReadAt ?? null;
    }
    extras[r.id] = {
      lastPostAt: last[0]?.createdAt ?? null,
      lastPostAuthorId: last[0]?.authorId ?? null,
      lastReadAt,
    };
  }

  return NextResponse.json({
    forums: filtered.map((f) => ({
      ...f,
      memberCount: counts[f.id] || 0,
      lastPostAt: extras[f.id]?.lastPostAt ?? null,
      lastPostAuthorId: extras[f.id]?.lastPostAuthorId ?? null,
      lastReadAt: extras[f.id]?.lastReadAt ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    description?: string;
    visibility?: string;
    projectId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  if (title.length < 2) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  const description = (body.description || "").trim().slice(0, 2000);
  const visibility =
    body.visibility === "private" ? "private" : "public";
  let projectId = body.projectId || null;

  // If linking to project, must be owner/admin of project
  if (projectId) {
    const m = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, session.id)
        )
      )
      .limit(1);
    if (!m[0] || !["owner", "admin"].includes(m[0].role)) {
      return NextResponse.json(
        { error: "Need project owner/admin to link forum" },
        { status: 403 }
      );
    }
    const p = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!p[0]) projectId = null;
  }

  const id = uid();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(forums).values({
    id,
    title,
    description,
    visibility,
    ownerId: session.id,
    projectId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(forumMembers).values({
    id: uid(),
    forumId: id,
    userId: session.id,
    role: "owner",
    joinedAt: now,
  });

  return NextResponse.json({ id, title, projectId }, { status: 201 });
}
