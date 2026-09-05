import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { forums, forumMembers, forumPosts, users } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function canAccessForum(forumId: string, userId?: string) {
  const rows = await db.select().from(forums).where(eq(forums.id, forumId)).limit(1);
  const forum = rows[0];
  if (!forum) return { forum: null, allowed: false };
  if (forum.visibility === "public") return { forum, allowed: true };
  if (!userId) return { forum, allowed: false };
  if (forum.ownerId === userId) return { forum, allowed: true };
  const mem = await db.select().from(forumMembers)
    .where(and(eq(forumMembers.forumId, forumId), eq(forumMembers.userId, userId))).limit(1);
  return { forum, allowed: !!mem[0] };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const { id } = await ctx.params;
  const session = await getSessionUser();
  const { forum, allowed } = await canAccessForum(id, session?.id);
  if (!forum) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const posts = await db.select({
    id: forumPosts.id, body: forumPosts.body, kind: forumPosts.kind,
    mediaPath: forumPosts.mediaPath, parentId: forumPosts.parentId,
    createdAt: forumPosts.createdAt, authorId: forumPosts.authorId,
    authorName: users.name, authorUsername: users.username, authorColor: users.avatarColor,
  }).from(forumPosts).innerJoin(users, eq(users.id, forumPosts.authorId))
    .where(eq(forumPosts.forumId, id)).orderBy(asc(forumPosts.createdAt)).limit(200);
    // mark forum as read for current user
  if (session) {
    const now = Math.floor(Date.now() / 1000);
    const mem = await db.select().from(forumMembers)
      .where(and(eq(forumMembers.forumId, id), eq(forumMembers.userId, session.id))).limit(1);
    if (mem[0]) {
      await db.update(forumMembers).set({ lastReadAt: now })
        .where(and(eq(forumMembers.forumId, id), eq(forumMembers.userId, session.id)));
    } else {
      await db.insert(forumMembers).values({
        id: uid(), forumId: id, userId: session.id, role: "member", lastReadAt: now, joinedAt: now,
      });
    }
  }
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { forum, allowed } = await canAccessForum(id, session.id);
  if (!forum) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { body?: string; kind?: string; mediaPath?: string; parentId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = (body.body || "").trim();
  type PostKind = "text" | "voice" | "system" | "image" | "file";
  const allowed: PostKind[] = ["text", "voice", "system", "image", "file"];
  const kind: PostKind = allowed.includes(body.kind as PostKind) ? (body.kind as PostKind) : "text";
  if (kind === "text" && !text && !body.mediaPath) return NextResponse.json({ error: "Body required" }, { status: 400 });
  const postId = uid();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(forumPosts).values({
    id: postId, forumId: id, authorId: session.id,
    body: text || (kind === "voice" ? "Voice note" : body.mediaPath ? "Attachment" : ""), kind,
    mediaPath: body.mediaPath || null, parentId: body.parentId || null, createdAt: now,
  });
  await db.update(forums).set({ updatedAt: now }).where(eq(forums.id, id));
  const mem = await db.select().from(forumMembers)
    .where(and(eq(forumMembers.forumId, id), eq(forumMembers.userId, session.id))).limit(1);
  if (!mem[0]) {
    await db.insert(forumMembers).values({ id: uid(), forumId: id, userId: session.id, role: "member", joinedAt: now });
  }
  return NextResponse.json({
    id: postId, body: text || (kind === "voice" ? "Voice note" : ""), kind,
    mediaPath: body.mediaPath || null, parentId: body.parentId || null, createdAt: now,
    authorId: session.id, authorName: session.name, authorUsername: session.username, authorColor: session.avatarColor,
  }, { status: 201 });
}
