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
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
  const m = rows[0];
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = path.join(uploadsRoot, m.path);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(m.size),
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="${encodeURIComponent(m.originalName)}"`,
    },
  });
}
