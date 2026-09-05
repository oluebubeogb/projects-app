import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureMigrated } from "@/lib/db";
import { callRooms } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Signal = {
  id: string;
  from: string;
  /** optional target user id — if set, only that user should process it */
  to?: string | null;
  type: string;
  payload: unknown;
  at: number;
};

const roomSignals = new Map<string, Signal[]>();
const MAX_SIGNALS = 400;

function getBuf(roomId: string) {
  let buf = roomSignals.get(roomId);
  if (!buf) {
    buf = [];
    roomSignals.set(roomId, buf);
  }
  return buf;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const rooms = await db.select().from(callRooms).where(eq(callRooms.id, id)).limit(1);
  const room = rooms[0];
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  // Allow signaling while open (ringing) OR live (in call). Only block closed.
  if (room.status === "closed") {
    return NextResponse.json({ error: "Room closed" }, { status: 410 });
  }

  let body: { type?: string; payload?: unknown; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = (body.type || "").trim();
  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 });

  // Participant leaving — does NOT close the room for others
  if (type === "leave") {
    const buf = getBuf(id);
    buf.push({
      id: `${Date.now()}-leave`,
      from: session.id,
      to: null,
      type: "leave",
      payload: body.payload ?? null,
      at: Date.now(),
    });
    return NextResponse.json({ ok: true, left: true });
  }

  // Host (or anyone) ending the whole room for everyone
  if (type === "hangup") {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(callRooms)
      .set({ status: "closed", closedAt: now })
      .where(eq(callRooms.id, id));
    roomSignals.delete(id);
    return NextResponse.json({ ok: true, closed: true });
  }

  const buf = getBuf(id);
  const sig: Signal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: session.id,
    to: body.to || null,
    type,
    payload: body.payload ?? null,
    at: Date.now(),
  };
  buf.push(sig);
  if (buf.length > MAX_SIGNALS) buf.splice(0, buf.length - MAX_SIGNALS);

  return NextResponse.json({ ok: true, id: sig.id });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const since = Number(req.nextUrl.searchParams.get("since") || "0") || 0;
  const buf = roomSignals.get(id) || [];
  // Deliver signals from others; if `to` is set, only the target receives it
  const signals = buf.filter(
    (s) =>
      s.at > since &&
      s.from !== session.id &&
      (!s.to || s.to === session.id)
  );

  return NextResponse.json({
    signals,
    serverTime: Date.now(),
  });
}
