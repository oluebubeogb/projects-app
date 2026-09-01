import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invites, projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { uid, MEMBER_COLORS } from "@/lib/utils";
import { z } from "zod";
import { randomBytes } from "crypto";
import { notify } from "@/lib/notifications";

const createSchema = z.object({
  projectId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // Must be owner/admin
  const mem = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, user.id)
      )
    )
    .limit(1);
  if (!mem[0] || !["owner", "admin"].includes(mem[0].role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.projectId, projectId));

  return NextResponse.json({ invites: rows });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const mem = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, data.projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .limit(1);
    if (!mem[0] || !["owner", "admin"].includes(mem[0].role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = randomBytes(24).toString("hex");
    const id = uid();

    await db.insert(invites).values({
      id,
      projectId: data.projectId,
      email: data.email.toLowerCase(),
      role: data.role,
      token,
      invitedBy: user.id,
    });

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get("origin") ||
      "http://localhost:3000";
    const inviteUrl = `${base}/invite?token=${token}`;

    return NextResponse.json({
      invite: { id, email: data.email, role: data.role, token, inviteUrl },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Accept invite */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

    const rows = await db
      .select()
      .from(invites)
      .where(eq(invites.token, token))
      .limit(1);
    const invite = rows[0];
    if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Already accepted" }, { status: 400 });
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: `This invite is for ${invite.email}` },
        { status: 403 }
      );
    }

    // Already member?
    const existing = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, invite.projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .limit(1);

    if (!existing[0]) {
      const color =
        MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
      await db.insert(projectMembers).values({
        id: uid(),
        projectId: invite.projectId,
        userId: user.id,
        role: invite.role,
        color,
      });
    }

    await db
      .update(invites)
      .set({ acceptedAt: Math.floor(Date.now() / 1000) })
      .where(eq(invites.id, invite.id));

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.id, invite.projectId))
      .limit(1);

    await notify({
      userId: invite.invitedBy,
      type: "invite_accepted",
      title: `${user.name} accepted your invite`,
      body: `They joined as ${invite.role}` + (proj[0] ? ` on ${proj[0].title}` : ""),
      link: proj[0] ? `/open?slug=${encodeURIComponent(proj[0].slug)}` : "/dashboard",
    });

    return NextResponse.json({
      ok: true,
      project: proj[0]
        ? { id: proj[0].id, slug: proj[0].slug, title: proj[0].title }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
