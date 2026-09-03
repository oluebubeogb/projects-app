import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/th>/gi, " | ")
    .replace(/<hr[^>]*>/gi, "\n———\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseBlocks(html: string): { type: string; text: string }[] {
  const blocks: { type: string; text: string }[] = [];
  // Split on major structural tags while preserving order
  const re =
    /<(h[1-3]|p|blockquote|li|pre|hr)[^>]*>([\s\S]*?)(?:<\/\1>|(?=<h[1-3]|<p|<blockquote|<li|<pre|<hr))/gi;
  let match: RegExpExecArray | null;
  const cleaned = html || "";
  // Simpler approach: split by horizontal rules as page breaks, then paragraphs
  const parts = cleaned.split(/<hr[^>]*>/i);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) blocks.push({ type: "pagebreak", text: "" });
    const section = parts[i];
    // Extract headings and paragraphs roughly
    const tagRe = /<(h[1-3]|p|blockquote|li|pre)[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = tagRe.exec(section)) !== null) {
      found = true;
      const type = m[1].toLowerCase();
      const text = stripHtml(m[2]).trim();
      if (text) blocks.push({ type, text });
    }
    if (!found) {
      const t = stripHtml(section).trim();
      if (t) blocks.push({ type: "p", text: t });
    }
  }
  return blocks;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const slug = req.nextUrl.searchParams.get("slug");
  if (!projectId && !slug) {
    return NextResponse.json({ error: "projectId or slug required" }, { status: 400 });
  }

  const rows = projectId
    ? await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    : await db.select().from(projects).where(eq(projects.slug, slug!)).limit(1);
  const project = rows[0];
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getSessionUser();
  if (project.visibility === "private") {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const mem = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.userId, user.id)
        )
      )
      .limit(1);
    if (!mem[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await db
    .select({
      name: users.name,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, project.id))
    .limit(40);

  const owners = members.filter((m) => m.role === "owner").map((m) => m.name);
  const others = members.filter((m) => m.role !== "owner").map((m) => m.name);
  const writtenBy = [...owners, ...others].join(", ") || "Unknown";

  const html = project.latestSnapshotHtml || "";
  const blocks = parseBlocks(html);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    compress: true,
    info: {
      Title: project.title,
      Author: writtenBy,
      Creator: "Projects",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ——— Page 1: title page ———
  doc.moveDown(4);
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#111827")
    .text(project.title, { align: "center" });
  doc.moveDown(1.5);
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#4b5563")
    .text(`Written by ${writtenBy}`, { align: "center" });
  doc.moveDown(2);
  doc
    .fontSize(10)
    .fillColor("#6b7280")
    .text(`Published ${formatDate(project.createdAt)}`, { align: "center" });
  doc.text(`Last updated on ${formatDate(project.updatedAt)}`, {
    align: "center",
  });

  // ——— Description pages ———
  if (project.description?.trim()) {
    doc.addPage();
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#111827")
      .text("Description");
    doc.moveDown(0.75);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#1f2937")
      .text(project.description.trim(), {
        align: "left",
        lineGap: 3,
      });
  }

  // ——— Content ———
  if (blocks.length) {
    doc.addPage();
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#111827")
      .text("Content");
    doc.moveDown(0.75);

    for (const b of blocks) {
      if (b.type === "pagebreak") {
        doc.addPage();
        continue;
      }
      if (b.type === "h1" || b.type === "h2" || b.type === "h3") {
        doc.moveDown(0.4);
        doc
          .font("Helvetica-Bold")
          .fontSize(13)
          .fillColor("#111827")
          .text(b.text, { lineGap: 2 });
        doc.moveDown(0.25);
      } else if (b.type === "blockquote") {
        doc
          .font("Helvetica-Oblique")
          .fontSize(10)
          .fillColor("#4b5563")
          .text(b.text, { indent: 12, lineGap: 2 });
        doc.moveDown(0.3);
      } else if (b.type === "pre") {
        doc
          .font("Courier")
          .fontSize(9)
          .fillColor("#1f2937")
          .text(b.text, { lineGap: 1 });
        doc.moveDown(0.3);
      } else {
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#1f2937")
          .text(b.text, { align: "left", lineGap: 3 });
        doc.moveDown(0.35);
      }
    }
  }

  doc.end();
  const pdf = await done;

  const filename = `${project.slug || "project"}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, max-age=60",
    },
  });
}
