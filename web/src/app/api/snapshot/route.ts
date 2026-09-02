import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  projectId: z.string().min(1),
  html: z.string().default(""),
  plainText: z.string().default(""),
});

/** Update latest public snapshot without creating a full commit */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

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

    await db
      .update(projects)
      .set({
        latestSnapshotHtml: data.html,
        searchText: data.plainText.toLowerCase().slice(0, 8000),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, data.projectId));

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
