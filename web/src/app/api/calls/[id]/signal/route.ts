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
  type: string;
  payload: unknown;
  at: number;
};

/** In-memory signal buffer per room (single-instance). Cleared when room closes. */
const roomSignals = new Map<string, Signal[]>();
const MAX_SIGNALS = 200;

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
  if (room.status !== "open") return NextResponse.json({ error: "Room closed" }, { status: 410 });

  let body: { type?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = (body.type || "").trim();
  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 });

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
  const signals = buf.filter((s) => s.at > since && s.from !== session.id);

  return NextResponse.json({
    signals,
    serverTime: Date.now(),
  });
}
