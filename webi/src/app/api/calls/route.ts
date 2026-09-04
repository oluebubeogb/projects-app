import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { callRooms } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
      /** Clients use this for WebRTC stub signaling */
      signalUrl: `/api/calls/${id}/signal`,
    },
    { status: 201 }
  );
}

/** List open rooms for a context */
export async function GET(req: NextRequest) {
  await ensureMigrated();
  const contextId = req.nextUrl.searchParams.get("contextId");
  if (!contextId) {
    return NextResponse.json({ rooms: [] });
  }
  const rooms = await db
    .select()
    .from(callRooms)
    .where(and(eq(callRooms.contextId, contextId), eq(callRooms.status, "open")))
    .limit(10);
  return NextResponse.json({ rooms });
}
