import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  const dbPath = path.join(dataDir, "projects.db");

  let dbFileExists = false;
  let dbFileSize = 0;
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
    dbFileExists = fs.existsSync(dbPath);
    if (dbFileExists) {
      dbFileSize = fs.statSync(dbPath).size;
    }
  } catch (e) {
    // ignore fs errors, report below
  }

  let allProjects: {
    id: string;
    slug: string;
    title: string;
    visibility: string;
    ownerId: string;
  }[] = [];
  let userCount = 0;
  let memberCount = 0;
  let dbQueryError: string | null = null;

  try {
    allProjects = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        visibility: projects.visibility,
        ownerId: projects.ownerId,
      })
      .from(projects)
      .limit(50);
    userCount = (await db.select({ c: sql<number>`count(*)` }).from(users))[0]
      ?.c as number;
    memberCount = (
      await db.select({ c: sql<number>`count(*)` }).from(projectMembers)
    )[0]?.c as number;
  } catch (e) {
    dbQueryError = e instanceof Error ? e.message : String(e);
  }

  const checks = {
    DATA_DIR_set: Boolean(process.env.DATA_DIR),
    DATA_DIR_is_data: process.env.DATA_DIR === "/data",
    dataDirExists,
    dataDirWritable,
    dbFileExists,
    dbFileNonEmpty: dbFileSize > 0,
    canQueryDb: !dbQueryError,
    hasUsers: userCount > 0,
    hasProjects: allProjects.length > 0,
    JWT_SECRET_set: Boolean(
      process.env.JWT_SECRET &&
        process.env.JWT_SECRET !== "change-me-in-production" &&
        process.env.JWT_SECRET !==
          "change-me-in-production-use-a-long-random-string"
    ),
    NEXT_PUBLIC_HOCUSPOCUS_URL: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || null,
  };

  const problems: string[] = [];
  if (!checks.DATA_DIR_set)
    problems.push("DATA_DIR env not set — defaulting to cwd/data (may not be a volume)");
  if (!checks.dataDirExists)
    problems.push(`data directory missing: ${dataDir}`);
  if (!checks.dataDirWritable)
    problems.push(`data directory not writable: ${dataDir}`);
  if (!checks.dbFileExists)
    problems.push(`SQLite file missing: ${dbPath} — no DB created yet or wrong path`);
  if (checks.dbFileExists && !checks.dbFileNonEmpty)
    problems.push("SQLite file is empty (0 bytes)");
  if (dbQueryError)
    problems.push(`DB query failed: ${dbQueryError}`);
  if (checks.canQueryDb && !checks.hasUsers)
    problems.push("No users in DB — register may have failed or different DB file");
  if (checks.canQueryDb && !checks.hasProjects)
    problems.push(
      "No projects in DB — create never wrote, or writes go to a different DATA_DIR"
    );
  if (!checks.JWT_SECRET_set)
    problems.push("JWT_SECRET is missing or still the default placeholder");

  return NextResponse.json({
    ok: problems.length === 0,
    problems,
    checks,
    paths: {
      dataDir,
      dbPath,
      cwd: process.cwd(),
      dataDirListing,
      dbFileSize,
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
    },
  });
}
