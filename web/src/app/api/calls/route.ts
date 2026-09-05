import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { callRooms } from "@/lib/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Unanswered ring expires after this many seconds (3 minutes) */
const RING_TTL_SEC = 180;

/** Create a call room */
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

  // Close previous unanswered open rooms by this host for this context
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
      ringTtlSec: RING_TTL_SEC,
    },
    { status: 201 }
  );
}

/** List rooms: open (ringing) only if fresh; live rooms always returned */
export async function GET(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  const contextId = req.nextUrl.searchParams.get("contextId");
  if (!contextId) {
    return NextResponse.json({ rooms: [], me: session?.id || null });
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - RING_TTL_SEC;

  // Auto-close only unanswered "open" rooms older than 3 minutes.
  // Do NOT touch "live" rooms — those stay until hangup.
  await db
    .update(callRooms)
    .set({ status: "closed", closedAt: now })
    .where(
      and(
        eq(callRooms.contextId, contextId),
        eq(callRooms.status, "open"),
        lt(callRooms.createdAt, cutoff)
      )
    );

  // Ringing rooms (open + fresh) OR active live rooms
  const openFresh = await db
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

  const live = await db
    .select({
      id: callRooms.id,
      kind: callRooms.kind,
      contextId: callRooms.contextId,
      hostId: callRooms.hostId,
      status: callRooms.status,
      createdAt: callRooms.createdAt,
    })
    .from(callRooms)
    .where(and(eq(callRooms.contextId, contextId), eq(callRooms.status, "live")))
    .limit(10);

  const rooms = [...openFresh, ...live];
  return NextResponse.json({ rooms, me: session?.id || null });
}

/** Close a room (any participant may end) */
export async function DELETE(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roomId = req.nextUrl.searchParams.get("id");
  if (!roomId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  // Any authenticated member of the context can close — host or participant
  await db
    .update(callRooms)
    .set({ status: "closed", closedAt: now })
    .where(eq(callRooms.id, roomId));

  return NextResponse.json({ ok: true });
}

/** Mark room as live (answered) */
export async function PATCH(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || body.status !== "live") {
    return NextResponse.json({ error: "id and status=live required" }, { status: 400 });
  }

  await db
    .update(callRooms)
    .set({ status: "live" })
    .where(and(eq(callRooms.id, body.id), eq(callRooms.status, "open")));

  return NextResponse.json({ ok: true });
}
