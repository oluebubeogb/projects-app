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
