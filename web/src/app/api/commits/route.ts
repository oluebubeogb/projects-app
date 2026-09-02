import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { commits, projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { uid } from "@/lib/utils";
import { upsertProjectFts } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string().min(1),
  message: z.string().min(1).max(500).default("Update"),
  plainText: z.string().optional().default(""),
  html: z.string().optional().default(""),
});

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const user = await getSessionUser();
  const proj = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!proj[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Public projects allow listing history; private require membership
  if (proj[0].visibility === "private") {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (!mem[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: commits.id,
      message: commits.message,
      plainText: commits.plainText,
      html: commits.html,
      createdAt: commits.createdAt,
      authorId: commits.authorId,
      authorName: users.name,
      authorColor: users.avatarColor,
    })
    .from(commits)
    .innerJoin(users, eq(commits.authorId, users.id))
    .where(eq(commits.projectId, projectId))
    .orderBy(desc(commits.createdAt))
    .limit(50);

  return NextResponse.json({ commits: rows });
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
    if (!mem[0] || !["owner", "admin", "editor"].includes(mem[0].role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = uid();
    await db.insert(commits).values({
      id,
      projectId: data.projectId,
      authorId: user.id,
      message: data.message,
      plainText: data.plainText,
      html: data.html,
    });

    // Also update public snapshot on project
    await db
      .update(projects)
      .set({
        latestSnapshotHtml: data.html || "",
        searchText: `${data.plainText || ""}`.toLowerCase().slice(0, 8000),
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(projects.id, data.projectId));

    // Refresh FTS index
    const proj = await db.select().from(projects).where(eq(projects.id, data.projectId)).limit(1);
    if (proj[0] && proj[0].visibility === "public") {
      upsertProjectFts(
        data.projectId,
        proj[0].title,
        proj[0].description || "",
        data.plainText || ""
      );
    }

    return NextResponse.json({
      commit: {
        id,
        message: data.message,
        createdAt: Math.floor(Date.now() / 1000),
        authorName: user.name,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
