import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { slugify, uid, MEMBER_COLORS } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  visibility: z.enum(["public", "private"]).default("public"),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db
    .select({
      project: projects,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id))
    .orderBy(desc(projects.updatedAt));

  return NextResponse.json({
    projects: memberships.map((m) => ({
      ...m.project,
      role: m.role,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const id = uid();
    let slug = slugify(data.title) || "project";
    if (!slug || slug.length < 1) slug = "project";

    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      slug = `${slug}-${id.slice(0, 8)}`;
    }

    await db.insert(projects).values({
      id,
      slug,
      title: data.title,
      description: data.description ?? "",
      visibility: data.visibility,
      ownerId: user.id,
      searchText: `${data.title} ${data.description ?? ""}`.toLowerCase(),
    });

    await db.insert(projectMembers).values({
      id: uid(),
      projectId: id,
      userId: user.id,
      role: "owner",
      color: MEMBER_COLORS[0],
    });

    // Verify write landed
    const check = await db
      .select({ slug: projects.slug })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    console.log(`[projects] created id=${id} slug=${slug} verified=${check[0]?.slug}`);

    return NextResponse.json({
      project: { id, slug, title: data.title, visibility: data.visibility },
    });
  } catch (err) {
    console.error("[projects] create error:", err);
    const message =
      err instanceof z.ZodError
        ? err.errors[0]?.message
        : err instanceof Error
          ? err.message
          : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
