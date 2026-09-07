import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
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


const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

/** Update project name, description, visibility (owner/admin only). */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, data.id))
      .limit(1);
    const project = rows[0];
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const mem = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.userId, user.id)
        )
      )
      .limit(1);

    const role = mem[0]?.role;
    if (!role || !["owner", "admin"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const title = data.title?.trim() ?? project.title;
    const description =
      data.description !== undefined ? data.description : project.description;
    const visibility = data.visibility ?? project.visibility;

    await db
      .update(projects)
      .set({
        title,
        description,
        visibility,
        searchText: `${title} ${description}`.toLowerCase(),
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(projects.id, project.id));

    return NextResponse.json({
      project: {
        id: project.id,
        slug: project.slug,
        title,
        description,
        visibility,
      },
    });
  } catch (err) {
    console.error("[projects] update error:", err);
    const message =
      err instanceof z.ZodError
        ? err.errors[0]?.message
        : err instanceof Error
          ? err.message
          : "Failed to update project";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
