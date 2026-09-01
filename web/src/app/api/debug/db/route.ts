import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ALLOW_DEBUG !== "1" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  const allProjects = await db.select().from(projects).limit(50);
  const userCount = (await db.select().from(users)).length;
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

  return NextResponse.json({
    dataDir,
    cwd: process.cwd(),
    userCount,
    projectCount: allProjects.length,
    projects: allProjects.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      visibility: p.visibility,
    })),
  });
}
