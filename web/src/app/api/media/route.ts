import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { media, projectMembers } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { uid } from "@/lib/utils";
import path from "path";
import fs from "fs";

const uploadsRoot =
  process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(process.cwd(), "public", "uploads");

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const mem = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, user.id)
      )
    )
    .limit(1);
  if (!mem[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select()
    .from(media)
    .where(eq(media.projectId, projectId))
    .orderBy(desc(media.createdAt))
    .limit(100);

  return NextResponse.json({
    media: rows.map((m) => ({
      ...m,
      url: `/api/media/file?id=${m.id}`,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const projectId = form.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "file and projectId required" },
        { status: 400 }
      );
    }

    const mem = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .limit(1);
    if (!mem[0] || !["owner", "admin", "editor"].includes(mem[0].role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ];
    if (!allowed.includes(file.type) && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Max 8MB" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const filename = `${uid().slice(0, 12)}.${ext}`;
    const subdir = new Date().toISOString().slice(0, 7); // YYYY-MM
    const dir = path.join(uploadsRoot, subdir);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, filename);

    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buf);

    const id = uid();
    const relPath = `${subdir}/${filename}`;

    await db.insert(media).values({
      id,
      projectId,
      userId: user.id,
      filename,
      originalName: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      path: relPath,
    });

    return NextResponse.json({
      media: {
        id,
        filename,
        originalName: file.name,
        mime: file.type,
        size: file.size,
        url: `/api/media/file?id=${id}`,
      },
    });
  } catch (e) {
    console.error("[media] upload", e);
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
