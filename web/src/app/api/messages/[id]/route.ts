import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { conversations, conversationMembers, messages, users } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function isMember(conversationId: string, userId: string) {
  const rows = await db.select().from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId))).limit(1);
  return !!rows[0];
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await isMember(id, session.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.select({
    id: messages.id, body: messages.body, kind: messages.kind, mediaPath: messages.mediaPath,
    createdAt: messages.createdAt, authorId: messages.authorId, authorName: users.name,
    authorColor: users.avatarColor, authorUsername: users.username,
  }).from(messages).innerJoin(users, eq(users.id, messages.authorId))
    .where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt)).limit(300);
  const now = Math.floor(Date.now() / 1000);
  await db.update(conversationMembers).set({ lastReadAt: now })
    .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, session.id)));
  return NextResponse.json({ messages: rows });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await isMember(id, session.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const now = Math.floor(Date.now() / 1000);
  await db.update(conversationMembers).set({ lastReadAt: now })
    .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, session.id)));
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await isMember(id, session.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { body?: string; kind?: string; mediaPath?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = (body.body || "").trim();
  const allowed = new Set(["text", "voice", "system", "image", "file"]);
  let kind = allowed.has(body.kind || "") ? (body.kind as string) : "text";
  if (!text && !body.mediaPath && kind === "text") return NextResponse.json({ error: "Body required" }, { status: 400 });
  const msgId = uid();
  const now = Math.floor(Date.now() / 1000);
  const displayBody = text || (kind === "voice" ? "Voice note" : body.mediaPath ? "Attachment" : "");
  await db.insert(messages).values({
    id: msgId, conversationId: id, authorId: session.id,
    body: displayBody, kind,
    mediaPath: body.mediaPath || null, createdAt: now,
  });
  await db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, id));
  return NextResponse.json({
    id: msgId, body: displayBody, kind,
    mediaPath: body.mediaPath || null, createdAt: now,
    authorId: session.id, authorName: session.name, authorColor: session.avatarColor,
  }, { status: 201 });
}
