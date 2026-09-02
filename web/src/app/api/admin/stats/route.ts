import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, sqlite } from "@/lib/db";
import { users, projects, projectMembers, media, commits } from "@/lib/db/schema";
import { sql, count } from "drizzle-orm";

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
    sqlite.prepare(`SELECT count(*) FROM projects_fts`).get();
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
