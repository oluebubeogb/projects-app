import { NextRequest, NextResponse } from "next/server";
import { db, dbHealth } from "@/lib/db";
import { projects, users, projectMembers } from "@/lib/db/schema";
import { sql, count } from "drizzle-orm";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.DEBUG_KEY || "projects-debug";
  const allowed =
    key === expected ||
    process.env.ALLOW_DEBUG === "1" ||
    process.env.NODE_ENV !== "production";

  if (!allowed) {
    return NextResponse.json(
      {
        error: "disabled",
        hint: "Open /api/debug/db?key=projects-debug  or set ALLOW_DEBUG=1",
      },
      { status: 403 }
    );
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  let dataDirExists = false;
  let dataDirWritable = false;
  let dataDirListing: string[] = [];

  try {
    dataDirExists = fs.existsSync(dataDir);
    if (dataDirExists) {
      dataDirListing = fs.readdirSync(dataDir).slice(0, 30);
      try {
        fs.accessSync(dataDir, fs.constants.W_OK);
        dataDirWritable = true;
      } catch {
        dataDirWritable = false;
      }
    }
  } catch {
    /* ignore */
  }

  let canQueryDb = false;
  let dbQueryError: string | null = null;
  let userCount = 0;
  let memberCount = 0;
  let allProjects: { id: string; slug: string; title: string }[] = [];

  try {
    canQueryDb = await dbHealth();
    if (canQueryDb) {
      const [u] = await db.select({ c: count() }).from(users);
      userCount = u.c;
      const [m] = await db.select({ c: count() }).from(projectMembers);
      memberCount = m.c;
      allProjects = await db
        .select({
          id: projects.id,
          slug: projects.slug,
          title: projects.title,
        })
        .from(projects)
        .limit(50);
    }
  } catch (e) {
    dbQueryError = e instanceof Error ? e.message : String(e);
  }

  const checks = {
    engine: "postgresql",
    DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
    REDIS_URL_set: Boolean(process.env.REDIS_URL),
    DATA_DIR_set: Boolean(process.env.DATA_DIR),
    dataDirExists,
    dataDirWritable,
    canQueryDb,
    hasUsers: userCount > 0,
    hasProjects: allProjects.length > 0,
    JWT_SECRET_set:
      Boolean(process.env.JWT_SECRET) &&
      process.env.JWT_SECRET !== "change-me-to-a-long-random-string" &&
      process.env.JWT_SECRET !== "change-me-in-production-use-a-long-random-string",
  };

  const problems: string[] = [];
  if (!checks.DATABASE_URL_set)
    problems.push("DATABASE_URL env not set");
  if (!checks.canQueryDb)
    problems.push(`Cannot query PostgreSQL${dbQueryError ? `: ${dbQueryError}` : ""}`);
  if (checks.canQueryDb && !checks.hasUsers)
    problems.push("No users in DB — register may have failed");
  if (checks.canQueryDb && !checks.hasProjects)
    problems.push("No projects in DB");
  if (!checks.JWT_SECRET_set)
    problems.push("JWT_SECRET is missing or still the default placeholder");
  if (!checks.dataDirWritable)
    problems.push("DATA_DIR is not writable (media uploads will fail)");

  return NextResponse.json({
    ok: problems.length === 0,
    problems,
    checks,
    paths: {
      dataDir,
      cwd: process.cwd(),
      dataDirListing,
    },
    counts: {
      users: userCount,
      projects: allProjects.length,
      members: memberCount,
    },
    projects: allProjects,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      DATA_DIR: process.env.DATA_DIR || null,
      DATABASE_URL: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")
        : null,
      REDIS_URL: process.env.REDIS_URL || null,
      ALLOW_DEBUG: process.env.ALLOW_DEBUG || null,
      HOCUSPOCUS_URL: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || null,
    },
  });
}
