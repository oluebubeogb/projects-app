
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_BOTTOM = 56;
const DEFAULT_TEXT = "#1f2937";
const DEFAULT_HEADING = "#111827";

// PDF spacing controls. Edit these values to tune the generated document.
// Values are line-height multipliers passed to PDFKit\'s moveDown().
const PDF_SPACING = {
  blockAfter: 2,      // Paragraphs and regular content blocks
  headingAfter: 2,    // Space after h1/h2/h3
  listBetween: 2,   // Space between list items
  listAfter: 2,     // Space after a list
  tableAfter: 2,      // Space after tables
  quoteAfter: 2,      // Space after blockquotes
  codeAfter: 2,       // Space after code blocks
} as const;

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
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
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).replace(/[ \t]+/g, " ").trim();
}

function styleValue(style: string | undefined, property: string): string | undefined {
  if (!style) return undefined;
  const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim();
}

function parseColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "transparent") return fallback;
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const rgb = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/);
  if (rgb) {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(Number(n))));
    return `#${[clamp(Number(rgb[1])), clamp(Number(rgb[2])), clamp(Number(rgb[3]))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")}`;
  }
  const named: Record<string, string> = {
    black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
    blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080",
    gray: "#808080", grey: "#808080", teal: "#008080", transparent: fallback,
  };
  return named[v] || fallback;
}

function cssColor(style: string | undefined, fallback = DEFAULT_TEXT): string {
  return parseColor(styleValue(style, "color"), fallback);
}

function cssBackground(style: string | undefined): string | undefined {
  const value = styleValue(style, "background-color") || styleValue(style, "background");
  return value ? parseColor(value, "#ffffff") : undefined;
}

function cssFontSize(style: string | undefined, fallback = 11): number {
  const value = styleValue(style, "font-size");
  const match = value?.match(/([0-9.]+)px/i);
  return match ? Math.max(6, Math.min(48, Number(match[1]))) : fallback;
}

type PdfBlock =
  | { type: "p" | "h1" | "h2" | "h3" | "blockquote" | "pre" | "ul" | "ol"; html: string; style?: string }
  | { type: "table"; html: string; style?: string };

/** Parse top-level editor blocks. Lists are captured as one block so nested <p> tags
 * inside list items cannot be rendered twice or overlap subsequent content. */
function parseBlocks(html: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const source = html || "";
  const blockRe = /<(table|h[1-3]|blockquote|pre|ul|ol|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(source))) {
    const raw = match[0];
    const type = match[1].toLowerCase() as PdfBlock["type"];
    const style = raw.match(/^<[^>]+style=["']([^"']*)["']/i)?.[1];
    blocks.push({ type, html: type === "table" ? raw : match[2], style });
  }
  if (!blocks.length && source.trim()) blocks.push({ type: "p", html: source });
  return blocks;
}

function inlineTokens(html: string): string[] {
  const tokenRe = /(<strong[^>]*>|<\/strong>|<b[^>]*>|<\/b>|<em[^>]*>|<\/em>|<i[^>]*>|<\/i>|<code[^>]*>|<\/code>|<span[^>]*>|<\/span>|<mark[^>]*>|<\/mark>|<a[^>]*>|<\/a>)/gi;
  return html.split(tokenRe).filter(Boolean);
}

function drawStyledInline(
  doc: PDFKit.PDFDocument,
  html: string,
  fallbackSize = 11,
  options: { x?: number; y?: number; width?: number; color?: string; bold?: boolean } = {}
) {
  const x = options.x ?? doc.page.margins.left;
  const y = options.y ?? doc.y;
  const width = options.width;
  doc.x = x;
  doc.y = y;

  const base = { size: fallbackSize, color: options.color || DEFAULT_TEXT, bold: !!options.bold, italic: false, background: undefined as string | undefined };
  const stack = [base];
  const parts = inlineTokens(html);

  const applyText = (text: string) => {
    const clean = decodeHtml(text.replace(/<[^>]+>/g, ""));
    if (!clean) return;
    const s = stack[stack.length - 1];
    doc.font(s.bold ? "Helvetica-Bold" : s.italic ? "Helvetica-Oblique" : "Helvetica")
      .fontSize(s.size)
      .fillColor(s.color);
    if (s.background) {
      const w = doc.widthOfString(clean);
      const h = s.size * 1.25;
      doc.save().fillColor(s.background).rect(doc.x, doc.y + 1, Math.min(w + 2, width ?? w + 2), h).fill().restore();
      doc.fillColor(s.color);
    }
    doc.text(clean.replace(/\s+/g, " "), { continued: true, width });
  };

  for (const part of parts) {
    if (/^<(strong|b)[^>]*>/i.test(part)) { stack.push({ ...stack[stack.length - 1], bold: true }); continue; }
    if (/^<\/(strong|b)>$/i.test(part)) { if (stack.length > 1) stack.pop(); continue; }
    if (/^<(em|i)[^>]*>/i.test(part)) { stack.push({ ...stack[stack.length - 1], italic: true }); continue; }
    if (/^<\/(em|i)>$/i.test(part)) { if (stack.length > 1) stack.pop(); continue; }
    if (/^<(span|mark)/i.test(part)) {
      const style = part.match(/style=["']([^"']*)["']/i)?.[1];
      const next = {
        ...stack[stack.length - 1],
        size: cssFontSize(style, stack[stack.length - 1].size),
        color: cssColor(style, stack[stack.length - 1].color),
        background: cssBackground(style) || (part.match(/data-color=["']([^"']+)["']/i)?.[1] ? parseColor(part.match(/data-color=["']([^"']+)["']/i)?.[1], "#ffffff") : stack[stack.length - 1].background),
      };
      stack.push(next);
      continue;
    }
    if (/^<\/(span|mark)>$/i.test(part)) { if (stack.length > 1) stack.pop(); continue; }
    if (/^<code/i.test(part)) { stack.push({ ...stack[stack.length - 1], bold: false }); continue; }
    if (/^<\/code>/i.test(part)) { if (stack.length > 1) stack.pop(); continue; }
    if (/^<a/i.test(part) || /^<\/a>/i.test(part)) continue;
    applyText(part);
  }
  doc.text("");
  doc.x = x;
}

function pageRemaining(doc: PDFKit.PDFDocument): number {
  return doc.page.height - PAGE_BOTTOM - doc.y;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (pageRemaining(doc) < needed) {
    doc.addPage();
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  }
}

function drawTable(doc: PDFKit.PDFDocument, html: string) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi)].map((c) => ({
      html: c[3],
      text: stripHtml(c[3]),
      style: c[2].match(/style=["']([^"']*)["']/i)?.[1],
      header: c[1].toLowerCase() === "th",
    }))
  ).filter((r) => r.length);
  if (!rows.length) return;

  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, () => usable / cols);
  const pad = 7;
  const lineGap = 2;

  for (const row of rows) {
    const heights = row.map((cell, ci) => {
      const size = cssFontSize(cell.style, 9);
      const width = Math.max(20, widths[ci] - pad * 2);
      doc.font(cell.header ? "Helvetica-Bold" : "Helvetica").fontSize(size);
      return Math.max(30, doc.heightOfString(cell.text || " ", { width, lineGap }) + pad * 2);
    });
    const rowHeight = Math.max(...heights, 30);
    ensureSpace(doc, rowHeight + 4);
    const y = doc.y;
    let x = left;

    for (let ci = 0; ci < cols; ci++) {
      const cell = row[ci] || { html: "", text: "", style: undefined, header: false };
      const bg = cssBackground(cell.style) || (cell.header ? "#f3f4f6" : "#ffffff");
      doc.save().fillColor(bg).rect(x, y, widths[ci], rowHeight).fill().restore();
      doc.lineWidth(0.6).strokeColor("#cbd5e1").rect(x, y, widths[ci], rowHeight).stroke();
      drawStyledInline(doc, cell.html, cssFontSize(cell.style, 9), {
        x: x + pad,
        y: y + pad,
        width: widths[ci] - pad * 2,
        color: cssColor(cell.style, DEFAULT_TEXT),
        bold: cell.header,
      });
      x += widths[ci];
    }
    doc.x = left;
    doc.y = y + rowHeight;
  }
  // One full line-height after a table keeps the following block visually separated.
  doc.moveDown(1);
  doc.x = left;
}

function drawList(doc: PDFKit.PDFDocument, html: string, ordered: boolean) {
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  let index = 1;
  for (const item of items) {
    const text = stripHtml(item[1]);
    if (!text) continue;
    ensureSpace(doc, 22);
    const prefix = ordered ? `${index}. ` : "• ";
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right - 12;
    doc.font("Helvetica").fontSize(11).fillColor(DEFAULT_TEXT).text(prefix, x, doc.y, { continued: true });
    drawStyledInline(doc, item[1], 11, { x: doc.x, y: doc.y, width });
    doc.x = x;
    // Half a line-height between list items keeps lists compact but readable.
    doc.moveDown(0.5);
    index++;
  }
  // Keep the next non-list block from running into the list.
  doc.moveDown(PDF_SPACING.listAfter);
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
  if (!projectId && !slug) return NextResponse.json({ error: "projectId or slug required" }, { status: 400 });

  const rows = projectId
    ? await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    : await db.select().from(projects).where(eq(projects.slug, slug!)).limit(1);
  const project = rows[0];
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getSessionUser();
  if (project.visibility === "private") {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const mem = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, user.id))).limit(1);
    if (!mem[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await db.select({ name: users.name, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, project.id))
    .limit(40);
  const owners = members.filter((m) => m.role === "owner").map((m) => m.name);
  const others = members.filter((m) => m.role !== "owner").map((m) => m.name);
  const writtenBy = [...owners, ...others].join(", ") || "Unknown";

  const blocks = parseBlocks(project.latestSnapshotHtml || "");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: PAGE_BOTTOM, bottom: PAGE_BOTTOM, left: PAGE_BOTTOM, right: PAGE_BOTTOM },
    compress: true,
    info: { Title: project.title, Author: writtenBy, Creator: "Projects" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Title page
  doc.moveDown(4);
  doc.font("Helvetica-Bold").fontSize(22).fillColor(DEFAULT_HEADING).text(project.title, { align: "center" });
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text(`Written by ${writtenBy}`, { align: "center" });
  doc.moveDown(2);
  doc.fontSize(10).fillColor("#6b7280").text(`Published ${formatDate(project.createdAt)}`, { align: "center" });
  doc.text(`Last updated on ${formatDate(project.updatedAt)}`, { align: "center" });

  if (project.description?.trim()) {
    doc.addPage();
    doc.x = doc.page.margins.left;
    doc.font("Helvetica-Bold").fontSize(14).fillColor(DEFAULT_HEADING).text("Description");
    doc.moveDown(0.75);
    doc.font("Helvetica").fontSize(11).fillColor(DEFAULT_TEXT).text(project.description.trim(), { align: "left", lineGap: 3 });
  }

  if (blocks.length) {
    doc.addPage();
    doc.x = doc.page.margins.left;
    doc.font("Helvetica-Bold").fontSize(14).fillColor(DEFAULT_HEADING).text("Content");
    doc.moveDown(0.75);

    for (const b of blocks) {
      doc.x = doc.page.margins.left;
      if (b.type === "table") {
        drawTable(doc, b.html);
        doc.x = doc.page.margins.left;
        continue;
      }
      if (b.type === "ul" || b.type === "ol") {
        drawList(doc, b.html, b.type === "ol");
        doc.x = doc.page.margins.left;
        continue;
      }

      const text = stripHtml(b.html);
      if (!text) continue;

      if (b.type === "h1" || b.type === "h2" || b.type === "h3") {
        const size = b.type === "h1" ? 20 : b.type === "h2" ? 16 : 13;
        const isFaq = /frequently asked questions/i.test(text);
        ensureSpace(doc, size + 18);
        if (isFaq) {
          const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          doc.save().fillColor("#ecfdf5").roundedRect(doc.page.margins.left, doc.y - 3, w, size + 12, 5).fill().restore();
        }
        doc.font("Helvetica-Bold").fontSize(size).fillColor(isFaq ? "#15803d" : cssColor(b.style, DEFAULT_HEADING)).text(text, { lineGap: 2 });
        // Full line-height after headings.
        doc.moveDown(1);
      } else if (b.type === "blockquote") {
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right - 28;
        const h = Math.max(34, doc.heightOfString(text, { width, lineGap: 2 }) + 16);
        ensureSpace(doc, h + 8);
        const y = doc.y;
        const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc.save().fillColor("#f0fdfa").roundedRect(doc.page.margins.left, y, w, h, 5).fill().restore();
        doc.save().fillColor("#14b8a6").rect(doc.page.margins.left, y, 4, h).fill().restore();
        drawStyledInline(doc, b.html, 10, { x: doc.page.margins.left + 14, y: y + 8, width, color: cssColor(b.style, "#4b5563") });
        doc.x = doc.page.margins.left;
        doc.y = y + h;
        doc.moveDown(1);
      } else if (b.type === "pre") {
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right - 20;
        const h = Math.max(30, doc.heightOfString(text, { width, lineGap: 2 }) + 16);
        ensureSpace(doc, h + 8);
        const y = doc.y;
        const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc.save().fillColor("#f3f4f6").roundedRect(doc.page.margins.left, y, w, h, 5).fill().restore();
        doc.font("Courier").fontSize(8.5).fillColor(cssColor(b.style, DEFAULT_TEXT)).text(text, doc.page.margins.left + 10, y + 8, { width, lineGap: 2 });
        doc.x = doc.page.margins.left;
        doc.y = y + h;
        doc.moveDown(1);
      } else {
        ensureSpace(doc, 20);
        drawStyledInline(doc, b.html, cssFontSize(b.style, 11), { x: doc.page.margins.left, y: doc.y, width: doc.page.width - doc.page.margins.left - doc.page.margins.right, color: cssColor(b.style, DEFAULT_TEXT) });
        doc.x = doc.page.margins.left;
        // One full line-height after paragraphs and other regular blocks.
        doc.moveDown(1);
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
