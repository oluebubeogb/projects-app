import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, pool } from "@/lib/db";
import { users, projects, projectMembers, media, commits } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [userCount] = await db.select({ c: count() }).from(users);
  const [projectCount] = await db.select({ c: count() }).from(projects);
  const [memberCount] = await db.select({ c: count() }).from(projectMembers);
  const [mediaCount] = await db.select({ c: count() }).from(media);
  const [commitCount] = await db.select({ c: count() }).from(commits);

  let ftsReady = false;
  try {
    await pool.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'idx_projects_search_vector'`
    );
    ftsReady = true;
  } catch {
    ftsReady = false;
  }

  return NextResponse.json({
    stats: {
      users: userCount.c,
      projects: projectCount.c,
      members: memberCount.c,
      media: mediaCount.c,
      commits: commitCount.c,
      ftsReady,
    },
  });
}
