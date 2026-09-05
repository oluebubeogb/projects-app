import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { callRooms } from "@/lib/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Rooms older than this (seconds) are auto-closed when listing */
const RING_TTL_SEC = 60;

/** Create a call room (voice / screenshare session) */
export async function POST(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { kind?: string; contextId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind =
    body.kind === "forum" || body.kind === "project" ? body.kind : "dm";
  const id = uid();
  const now = Math.floor(Date.now() / 1000);

  // Close any previous open rooms for this context by this host (avoid stale rings)
  if (body.contextId) {
    await db
      .update(callRooms)
      .set({ status: "closed", closedAt: now })
      .where(
        and(
          eq(callRooms.contextId, body.contextId),
          eq(callRooms.hostId, session.id),
          eq(callRooms.status, "open")
        )
      );
  }

  await db.insert(callRooms).values({
    id,
    kind,
    contextId: body.contextId || null,
    hostId: session.id,
    status: "open",
    createdAt: now,
    closedAt: null,
  });

  return NextResponse.json(
    {
      id,
      kind,
      contextId: body.contextId || null,
      hostId: session.id,
      signalUrl: `/api/calls/${id}/signal`,
      expiresIn: RING_TTL_SEC,
    },
    { status: 201 }
  );
}

/** List open rooms for a context (only fresh rooms; expires stale ones) */
export async function GET(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  const contextId = req.nextUrl.searchParams.get("contextId");
  if (!contextId) {
    return NextResponse.json({ rooms: [], me: session?.id || null });
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - RING_TTL_SEC;

  // Auto-close rooms older than RING_TTL_SEC still marked open
  await db
    .update(callRooms)
    .set({ status: "closed", closedAt: now })
    .where(
      and(
        eq(callRooms.contextId, contextId),
        eq(callRooms.status, "open"),
        sql`${callRooms.createdAt} < ${cutoff}`
      )
    );

  const rooms = await db
    .select({
      id: callRooms.id,
      kind: callRooms.kind,
      contextId: callRooms.contextId,
      hostId: callRooms.hostId,
      status: callRooms.status,
      createdAt: callRooms.createdAt,
    })
    .from(callRooms)
    .where(
      and(
        eq(callRooms.contextId, contextId),
        eq(callRooms.status, "open"),
        gt(callRooms.createdAt, cutoff)
      )
    )
    .limit(10);

  return NextResponse.json({ rooms, me: session?.id || null });
}

/** Explicitly close a room */
export async function DELETE(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roomId = req.nextUrl.searchParams.get("id");
  if (!roomId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(callRooms)
    .set({ status: "closed", closedAt: now })
    .where(and(eq(callRooms.id, roomId), eq(callRooms.hostId, session.id)));

  return NextResponse.json({ ok: true });
}
