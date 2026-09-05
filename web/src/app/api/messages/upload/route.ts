import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureMigrated } from "@/lib/db";
import { uid } from "@/lib/utils";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA = process.env.DATA_DIR || path.join(process.cwd(), "data");

export async function POST(req: NextRequest) {
  await ensureMigrated();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const conversationId = form.get("conversationId") as string | null;

  if (!file || !conversationId) {
    return NextResponse.json({ error: "file and conversationId required" }, { status: 400 });
  }

  const isImage = file.type.startsWith("image/");
  if (!isImage && file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File max 5 MB" }, { status: 400 });
  }

  const dir = path.join(DATA, "messages", conversationId);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = uid();

  let kind: "image" | "voice" | "file" = "file";
  let filename: string;
  let publicPath: string;
  let width: number | undefined;
  let height: number | undefined;

  if (isImage) {
    kind = "image";
    // Full / display size (max 720 on long edge)
    const img720 = sharp(buffer).rotate();
    const meta = await img720.metadata();
    const out720 = await img720
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    filename = `${id}.webp`;
    const filepath = path.join(dir, filename);
    await writeFile(filepath, out720);

    // Thumbnail 480
    const out480 = await sharp(buffer)
      .rotate()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    await writeFile(path.join(dir, `${id}-480.webp`), out480);

    width = meta.width;
    height = meta.height;
    publicPath = `/api/media/file?path=${encodeURIComponent(`messages/${conversationId}/${filename}`)}`;
  } else if (file.type.startsWith("audio/")) {
    kind = "voice";
    const ext = (file.name.split(".").pop() || "webm").toLowerCase().replace(/[^a-z0-9]/g, "") || "webm";
    filename = `${id}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    publicPath = `/api/media/file?path=${encodeURIComponent(`messages/${conversationId}/${filename}`)}`;
  } else {
    kind = "file";
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    filename = `${id}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    publicPath = `/api/media/file?path=${encodeURIComponent(`messages/${conversationId}/${filename}`)}`;
  }

  return NextResponse.json({
    path: publicPath,
    path480: isImage
      ? `/api/media/file?path=${encodeURIComponent(`messages/${conversationId}/${id}-480.webp`)}&size=480`
      : undefined,
    originalName: file.name,
    kind,
    size: file.size,
    width,
    height,
  });
}
