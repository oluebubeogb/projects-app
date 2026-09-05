import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

const DATA = process.env.DATA_DIR || path.join(process.cwd(), "data");
const uploadsRoot =
  process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(process.cwd(), "public", "uploads");

function safeJoin(root: string, rel: string) {
  const resolved = path.resolve(root, rel);
  if (!resolved.startsWith(path.resolve(root))) {
    return null;
  }
  return resolved;
}

function mimeFromPath(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

function fileResponse(buf: Buffer, filePath: string, downloadName?: string) {
  const mime = mimeFromPath(filePath);
  const name = downloadName || path.basename(filePath);
  // Inline for viewable types (PDF, images, audio); attachment only for opaque binaries
  const inline =
    mime.startsWith("image/") ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/") ||
    mime === "application/pdf" ||
    mime.startsWith("text/");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const relPath = req.nextUrl.searchParams.get("path");
  const size = req.nextUrl.searchParams.get("size"); // 480 | 720

  // Message / generic path serving
  if (relPath) {
    // Prefer 480 variant when requested
    let candidate = relPath;
    if (size === "480" && relPath.endsWith(".webp") && !relPath.includes("-480.webp")) {
      candidate = relPath.replace(/\.webp$/, "-480.webp");
    }
    const filePath = safeJoin(DATA, candidate);
    if (!filePath || !fs.existsSync(filePath)) {
      // fallback to original if 480 missing
      const orig = safeJoin(DATA, relPath);
      if (!orig || !fs.existsSync(orig)) {
        return NextResponse.json({ error: "File missing" }, { status: 404 });
      }
      const buf = fs.readFileSync(orig);
      return fileResponse(buf, orig, path.basename(relPath));
    }
    const buf = fs.readFileSync(filePath);
    return fileResponse(buf, filePath, path.basename(relPath));
  }

  if (!id) return NextResponse.json({ error: "id or path required" }, { status: 400 });

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
