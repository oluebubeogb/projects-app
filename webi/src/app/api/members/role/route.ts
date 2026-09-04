import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const ALLOWED = new Set(["admin", "editor", "viewer"]);

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: string; userId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId || "";
  const userId = body.userId || "";
  const role = body.role || "";

  if (!projectId || !userId || !ALLOWED.has(role)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Caller must be owner or admin
  const me = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, session.id)
      )
    )
    .limit(1);
  if (!me[0] || !["owner", "admin"].includes(me[0].role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cannot change owner
  const target = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);
  if (!target[0]) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target[0].role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  await db
    .update(projectMembers)
    .set({ role: role as "admin" | "editor" | "viewer" })
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );

  return NextResponse.json({ ok: true });
}
