import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

const uploadsRoot =
  process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(process.cwd(), "public", "uploads");

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const size = req.nextUrl.searchParams.get("size"); // 480 | 720
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
  const m = rows[0];
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let filePath = path.join(uploadsRoot, m.path);
  if (size === "480" && m.path.endsWith(".webp")) {
    const candidate = filePath.replace(/\.webp$/, "-480.webp");
    if (fs.existsSync(candidate)) filePath = candidate;
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="${encodeURIComponent(m.originalName)}"`,
    },
  });
}
