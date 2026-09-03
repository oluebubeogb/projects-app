import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { forums, forumMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const { id } = await ctx.params;
  const rows = await db.select({
    userId: users.id, name: users.name, username: users.username,
    avatarColor: users.avatarColor, role: forumMembers.role, joinedAt: forumMembers.joinedAt,
  }).from(forumMembers).innerJoin(users, eq(users.id, forumMembers.userId))
    .where(eq(forumMembers.forumId, id));
  return NextResponse.json({ members: rows });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const forumRows = await db.select().from(forums).where(eq(forums.id, id)).limit(1);
  const forum = forumRows[0];
  if (!forum) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forum.visibility === "private" && forum.ownerId !== session.id) {
    return NextResponse.json({ error: "Private forum" }, { status: 403 });
  }
  const existing = await db.select().from(forumMembers)
    .where(and(eq(forumMembers.forumId, id), eq(forumMembers.userId, session.id))).limit(1);
  if (existing[0]) return NextResponse.json({ ok: true, already: true });
  const now = Math.floor(Date.now() / 1000);
  await db.insert(forumMembers).values({ id: uid(), forumId: id, userId: session.id, role: "member", joinedAt: now });
  return NextResponse.json({ ok: true }, { status: 201 });
}
