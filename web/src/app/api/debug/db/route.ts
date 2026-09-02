import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { projects, users, projectMembers } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * Always available diagnostics.
 * Optional key: ?key=projects-debug  (or set DEBUG_KEY env)
 * In production without key, still returns limited info if ALLOW_DEBUG=1
 */
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
  const databaseUrl = process.env.DATABASE_URL || "";

  let dataDirExists = false;
  let dataDirWritable = false;
  let dataDirListing: string[] = [];

  try {
    dataDirExists = fs.existsSync(dataDir);
    if (dataDirExists) {
      dataDirListing = fs.readdirSync(dataDir).slice(0, 20);
      try {
        const testFile = path.join(dataDir, ".write-test");
        fs.writeFileSync(testFile, "ok");
        fs.unlinkSync(testFile);
        dataDirWritable = true;
      } catch {
        dataDirWritable = false;
      }
    }
  } catch {
    /* ignore */
  }

  let dbQueryError: string | null = null;
  let userCount = 0;
  let memberCount = 0;
  let allProjects: { id: string; slug: string; title: string }[] = [];

  try {
    allProjects = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
      })
      .from(projects)
      .limit(50);
    userCount = (
      await db.select({ c: sql<number>`count(*)` }).from(users)
    )[0]?.c as number;
    memberCount = (
      await db.select({ c: sql<number>`count(*)` }).from(projectMembers)
    )[0]?.c as number;
  } catch (e) {
    dbQueryError = e instanceof Error ? e.message : String(e);
  }

  let pgOk = false;
  let pgVersion: string | null = null;
  try {
    const r = await pool.query("SELECT version() as v");
    pgOk = true;
    pgVersion = r.rows[0]?.v ?? null;
  } catch (e) {
    dbQueryError = dbQueryError || (e instanceof Error ? e.message : String(e));
  }

  const checks = {
    DATABASE_URL_set: Boolean(databaseUrl),
    DATA_DIR_set: Boolean(process.env.DATA_DIR),
    dataDirExists,
    dataDirWritable,
    canQueryDb: !dbQueryError && pgOk,
    hasUsers: userCount > 0,
    hasProjects: allProjects.length > 0,
    JWT_SECRET_set: Boolean(
      process.env.JWT_SECRET &&
        process.env.JWT_SECRET !== "change-me-in-production" &&
        process.env.JWT_SECRET !==
          "change-me-in-production-use-a-long-random-string"
    ),
    REDIS_URL_set: Boolean(process.env.REDIS_URL),
    NEXT_PUBLIC_HOCUSPOCUS_URL: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || null,
  };

  const problems: string[] = [];
  if (!checks.DATABASE_URL_set)
    problems.push("DATABASE_URL env not set");
  if (!checks.dataDirExists)
    problems.push(`data directory missing: ${dataDir}`);
  if (!checks.dataDirWritable)
    problems.push(`data directory not writable: ${dataDir}`);
  if (dbQueryError)
    problems.push(`DB query failed: ${dbQueryError}`);
  if (checks.canQueryDb && !checks.hasUsers)
    problems.push("No users in DB — register may have failed");
  if (checks.canQueryDb && !checks.hasProjects)
    problems.push("No projects in DB");
  if (!checks.JWT_SECRET_set)
    problems.push("JWT_SECRET is missing or still the default placeholder");

  return NextResponse.json({
    ok: problems.length === 0,
    problems,
    checks,
    paths: {
      dataDir,
      cwd: process.cwd(),
      dataDirListing,
    },
    postgres: {
      ok: pgOk,
      version: pgVersion,
      urlMasked: databaseUrl.replace(/:[^:@/]+@/, ":***@"),
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
      ALLOW_DEBUG: process.env.ALLOW_DEBUG || null,
      HOCUSPOCUS_URL: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || null,
      REDIS_URL: process.env.REDIS_URL ? "(set)" : null,
    },
  });
}


