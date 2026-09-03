import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function uid() {
  return crypto.randomUUID();
}

/** Simple relevance score for public search */
export function relevanceScore(
  query: string,
  title: string,
  description: string,
  content: string
): number {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return 0;

  let score = 0;
  const t = title.toLowerCase();
  const d = description.toLowerCase();
  const c = content.toLowerCase();

  for (const term of q) {
    if (t.includes(term)) score += 10;
    if (t.startsWith(term)) score += 5;
    if (d.includes(term)) score += 4;
    if (c.includes(term)) score += 1;
  }
  return score;
}

export const MEMBER_COLORS = [
  "#eab308", // yellow
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#a855f7", // purple
];


/** Tailored excerpt around the first query match in content. Ends with … never starts with … */
export function extractSearchExcerpt(
  query: string,
  content: string,
  maxLen = 160
): string | null {
  const q = query.trim().toLowerCase();
  if (!q || !content) return null;
  const terms = q.split(/\s+/).filter(Boolean);
  const lower = content.toLowerCase();
  let idx = -1;
  let matched = "";
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (idx < 0 || i < idx)) {
      idx = i;
      matched = term;
    }
  }
  if (idx < 0) {
    // fallback: description-like start
    const clean = content.replace(/\s+/g, " ").trim();
    if (!clean) return null;
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
  }
  // Prefer starting at sentence / word boundary before match
  const start = Math.max(0, idx - 40);
  let sliceStart = start;
  if (start > 0) {
    const space = content.indexOf(" ", start);
    if (space > start && space < idx) sliceStart = space + 1;
  }
  let excerpt = content.slice(sliceStart).replace(/\s+/g, " ").trim();
  if (excerpt.length > maxLen) {
    excerpt = excerpt.slice(0, maxLen).replace(/\s+\S*$/, "");
  }
  // Ensure we don't start mid-word if we cut at start>0 without space fix
  if (sliceStart > 0 && excerpt && !/^\w/.test(excerpt[0] || "")) {
    excerpt = excerpt.replace(/^\W+/, "");
  }
  if (!excerpt) return null;
  // Capitalize first letter for polish
  excerpt = excerpt.charAt(0).toUpperCase() + excerpt.slice(1);
  if (!excerpt.endsWith("…") && (sliceStart + excerpt.length < content.length || excerpt.length >= maxLen - 5)) {
    excerpt = excerpt.replace(/[.,;:!?]?$/, "") + "…";
  }
  return excerpt;
}
