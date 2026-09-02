import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") || "").trim();
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

  if (!slug) {
    return NextResponse.json({ error: "missing slug" }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);

    const all = await db
      .select({ slug: projects.slug, title: projects.title })
      .from(projects)
      .limit(50);

    return NextResponse.json({
      dataDir,
      cwd: process.cwd(),
      requestedSlug: slug,
      found: Boolean(rows[0]),
      project: rows[0] || null,
      allSlugs: all,
    });
  } catch (e) {
    return NextResponse.json(
      {
        dataDir,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
