import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { joinRequests, projectMembers, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { uid, MEMBER_COLORS } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existingMember = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, data.projectId),
        eq(projectMembers.userId, user.id)
      ),
    });
    if (existingMember) {
      return NextResponse.json({ error: "Already a member" }, { status: 400 });
    }

    const existingReq = await db.query.joinRequests.findFirst({
      where: and(
        eq(joinRequests.projectId, data.projectId),
        eq(joinRequests.userId, user.id),
        eq(joinRequests.status, "pending")
      ),
    });
    if (existingReq) {
      return NextResponse.json({ error: "Request already pending" }, { status: 400 });
    }

    await db.insert(joinRequests).values({
      id: uid(),
      projectId: data.projectId,
      userId: user.id,
      status: "pending",
      message: data.message || "",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors[0]?.message
        : err instanceof Error
          ? err.message
          : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Approve/reject — owner/admin only */
const reviewSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = reviewSchema.parse(body);

    const request = await db.query.joinRequests.findFirst({
      where: eq(joinRequests.id, data.requestId),
    });
    if (!request || request.status !== "pending") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, request.projectId),
        eq(projectMembers.userId, user.id)
      ),
    });
    if (
      !membership ||
      !["owner", "admin"].includes(membership.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (data.action === "approve") {
      const colorIndex =
        (
          await db
            .select()
            .from(projectMembers)
            .where(eq(projectMembers.projectId, request.projectId))
        ).length % MEMBER_COLORS.length;

      await db.insert(projectMembers).values({
        id: uid(),
        projectId: request.projectId,
        userId: request.userId,
        role: "editor",
        color: MEMBER_COLORS[colorIndex],
      });
      await db
        .update(joinRequests)
        .set({ status: "approved" })
        .where(eq(joinRequests.id, data.requestId));
    } else {
      await db
        .update(joinRequests)
        .set({ status: "rejected" })
        .where(eq(joinRequests.id, data.requestId));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
