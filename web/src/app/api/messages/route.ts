import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import {
  conversations,
  conversationMembers,
  messages,
  users,
} from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** List my conversations */
export async function GET() {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const my = await db
    .select({
      conversationId: conversationMembers.conversationId,
      lastReadAt: conversationMembers.lastReadAt,
      kind: conversations.kind,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(eq(conversationMembers.userId, session.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(40);

  const result = [];
  for (const c of my) {
    const peers = await db
      .select({
        userId: users.id,
        name: users.name,
        username: users.username,
        avatarColor: users.avatarColor,
      })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(
        and(
          eq(conversationMembers.conversationId, c.conversationId),
          ne(conversationMembers.userId, session.id)
        )
      )
      .limit(10);

    const last = await db
      .select({
        body: messages.body,
        kind: messages.kind,
        createdAt: messages.createdAt,
        authorId: messages.authorId,
      })
      .from(messages)
      .where(eq(messages.conversationId, c.conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    result.push({
      id: c.conversationId,
      kind: c.kind,
      title: c.title,
      updatedAt: c.updatedAt,
      lastReadAt: c.lastReadAt,
      peers,
      lastMessage: last[0] || null,
    });
  }

  return NextResponse.json({ conversations: result });
}

/** Start or get DM with a user by username */
export async function POST(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { username?: string; body?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username || "").trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const peerRows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const peer = peerRows[0];
  if (!peer) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (peer.id === session.id) {
    return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });
  }

  // Find existing DM between the two via membership intersection
  const myConvs = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(
      and(
        eq(conversationMembers.userId, session.id),
        eq(conversations.kind, "dm")
      )
    );
  let conversationId: string | undefined;
  for (const c of myConvs) {
    const peerIn = await db
      .select({ id: conversationMembers.id })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, c.conversationId),
          eq(conversationMembers.userId, peer.id)
        )
      )
      .limit(1);
    if (peerIn[0]) {
      conversationId = c.conversationId;
      break;
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (!conversationId) {
    conversationId = uid();
    await db.insert(conversations).values({
      id: conversationId,
      kind: "dm",
      title: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(conversationMembers).values([
      { id: uid(), conversationId, userId: session.id, lastReadAt: now },
      { id: uid(), conversationId, userId: peer.id, lastReadAt: null },
    ]);
  }

  // Optional first message
  let message = null;
  const text = (body.body || "").trim();
  if (text) {
    const mid = uid();
    const kind = body.kind === "voice" ? "voice" : "text";
    await db.insert(messages).values({
      id: mid,
      conversationId,
      authorId: session.id,
      body: text.slice(0, 10000),
      kind,
      mediaPath: null,
      createdAt: now,
    });
    await db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, conversationId));
    message = { id: mid, body: text, kind, createdAt: now };
  }

  return NextResponse.json({ conversationId, message }, { status: 201 });
}
