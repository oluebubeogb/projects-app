import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>(?=.)/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

function cssColor(style: string | undefined, fallback = "#1f2937"): string {
  const match = style?.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  return match?.[1]?.trim() || fallback;
}

function cssFontSize(style: string | undefined, fallback = 11): number {
  const match = style?.match(/font-size\s*:\s*([0-9.]+)px/i);
  return match ? Math.max(6, Math.min(48, Number(match[1]))) : fallback;
}

type PdfBlock =
  | { type: "p" | "h1" | "h2" | "h3" | "blockquote" | "pre" | "li" | "faq-question" | "faq-answer"; html: string; style?: string }
  | { type: "table"; html: string; style?: string };

function parseBlocks(html: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const source = html || "";
  const blockRe = /<(table|h[1-3]|p|blockquote|pre|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(source))) {
    const type = match[1].toLowerCase();
    const raw = match[0];
    if (type === "table") blocks.push({ type: "table", html: raw });
    else {
      const style = raw.match(/^<[^>]+style=[\"']([^\"']*)[\"']/i)?.[1];
      const body = match[2];
      blocks.push({ type: type as PdfBlock["type"], html: body, style });
    }
  }
  if (!blocks.length && source.trim()) blocks.push({ type: "p", html: source });
  return blocks;
}

function drawStyledInline(doc: PDFKit.PDFDocument, html: string, fallbackSize = 11) {
  const tokenRe = /(<strong>|<\/strong>|<b>|<\/b>|<em>|<\/em>|<i>|<\/i>|<code[^>]*>|<\/code>|<span[^>]*>|<\/span>|<a[^>]*>|<\/a>)/gi;
  const parts = html.split(tokenRe).filter(Boolean);
  let bold = false;
  let italic = false;
  let size = fallbackSize;
  let color = "#1f2937";
  for (const part of parts) {
    if (/^<(strong|b)>$/i.test(part)) { bold = true; continue; }
    if (/^<\/(strong|b)>$/i.test(part)) { bold = false; continue; }
    if (/^<(em|i)>$/i.test(part)) { italic = true; continue; }
    if (/^<\/(em|i)>$/i.test(part)) { italic = false; continue; }
    if (/^<span/i.test(part)) { size = cssFontSize(part.match(/style=[\"']([^\"']*)[\"']/i)?.[1], fallbackSize); color = cssColor(part.match(/style=[\"']([^\"']*)[\"']/i)?.[1]); continue; }
    if (/^<\/span>/i.test(part)) { size = fallbackSize; color = "#1f2937"; continue; }
    if (/^<code/i.test(part)) { bold = false; continue; }
    if (/^<\//i.test(part) || /^<a/i.test(part)) continue;
    const text = decodeHtml(part.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ");
    if (!text) continue;
    doc.font(bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica").fontSize(size).fillColor(color).text(text, { continued: true });
  }
  doc.text("");
}

function drawTable(doc: PDFKit.PDFDocument, html: string) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => stripHtml(c[2]))
  ).filter((r) => r.length);
  if (!rows.length) return;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, () => usable / cols);
  const lineHeight = 16;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const maxLines = Math.max(1, ...row.map((cell) => Math.ceil(doc.widthOfString(cell, { width: widths[0] - 12 }) / (widths[0] - 12))));
    const h = Math.max(28, maxLines * lineHeight + 10);
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    row.forEach((cell, ci) => {
      const x = doc.page.margins.left + widths.slice(0, ci).reduce((a, b) => a + b, 0);
      doc.rect(x, y, widths[ci], h).lineWidth(0.5).strokeColor("#d1d5db").stroke();
      if (ri === 0) doc.rect(x, y, widths[ci], h).fillOpacity(0.06).fillAndStroke("#111827", "#d1d5db").fillOpacity(1);
      doc.font(ri === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#1f2937").text(cell, x + 6, y + 6, { width: widths[ci] - 12, height: h - 8 });
    });
    doc.y = y + h;
  }
  doc.moveDown(0.5);
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Content");
    doc.moveDown(0.75);

    for (const b of blocks) {
      if (b.type === "table") {
        drawTable(doc, b.html);
        continue;
      }
      const text = stripHtml(b.html);
      if (!text) continue;
      if (b.type === "h1" || b.type === "h2" || b.type === "h3") {
        const size = b.type === "h1" ? 20 : b.type === "h2" ? 16 : 13;
        const isFaq = /frequently asked questions/i.test(text);
        doc.moveDown(0.5);
        if (isFaq) {
          doc.roundedRect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 28, 5).fillColor("#eefdf5").fill();
        }
        doc.font("Helvetica-Bold").fontSize(size).fillColor(isFaq ? "#15803d" : cssColor(b.style, "#111827")).text(text, { lineGap: 2 });
        doc.moveDown(0.2);
      } else if (b.type === "blockquote") {
        const y = doc.y;
        const height = Math.max(28, doc.heightOfString(text, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 28 }) + 16);
        doc.roundedRect(doc.page.margins.left, y, doc.page.width - doc.page.margins.left - doc.page.margins.right, height, 5).fillColor("#f0fdfa").fill();
        doc.rect(doc.page.margins.left, y, 4, height).fillColor("#14b8a6").fill();
        doc.font("Helvetica-Oblique").fontSize(10).fillColor("#4b5563").text(text, doc.page.margins.left + 14, y + 8, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 28, lineGap: 2 });
        doc.y = y + height + 8;
      } else if (b.type === "pre") {
        const y = doc.y;
        const h = doc.heightOfString(text, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20 }) + 16;
        doc.roundedRect(doc.page.margins.left, y, doc.page.width - doc.page.margins.left - doc.page.margins.right, h, 5).fillColor("#f3f4f6").fill();
        doc.font("Courier").fontSize(8.5).fillColor("#1f2937").text(text, doc.page.margins.left + 10, y + 8, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20 });
        doc.y = y + h + 8;
      } else if (b.type === "li") {
        doc.font("Helvetica").fontSize(11).fillColor("#1f2937").text(`• ${text}`, { indent: 8, lineGap: 2 });
        doc.moveDown(0.15);
      } else {
        drawStyledInline(doc, b.html, cssFontSize(b.style, 11));
        doc.moveDown(0.25);
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
