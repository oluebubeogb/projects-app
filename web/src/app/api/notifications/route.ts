import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, desc, and, isNull, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";

  let rows;
  if (unreadOnly) {
    rows = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  } else {
    rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  const unreadCount = await db
    .select({ c: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, user.id), isNull(notifications.readAt))
    );

  return NextResponse.json({
    notifications: rows,
    unreadCount: Number(unreadCount[0]?.c ?? 0),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, all } = body as { id?: string; all?: boolean };

  if (all) {
    await db
      .update(notifications)
      .set({ readAt: Math.floor(Date.now() / 1000) })
      .where(
        and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      );
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "id or all required" }, { status: 400 });

  await db
    .update(notifications)
    .set({ readAt: Math.floor(Date.now() / 1000) })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, user.id))
    );

  return NextResponse.json({ ok: true });
}
