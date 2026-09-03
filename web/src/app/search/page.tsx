import Link from "next/link";
import { db, searchProjectsFts } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { relevanceScore, extractSearchExcerpt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let results: (typeof projects.$inferSelect & {
    score: number;
    excerpt: string | null;
  })[] = [];
  let usedFts = false;

  if (query) {
    const ftsHits = await searchProjectsFts(query, 40);
    if (ftsHits.length > 0) {
      usedFts = true;
      const ids = ftsHits.map((h) => h.projectId);
      const rows = await db
        .select()
        .from(projects)
        .where(inArray(projects.id, ids));
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      results = ftsHits
        .map((h, i) => {
          const p = byId[h.projectId];
          if (!p || p.visibility !== "public") return null;
          const source =
            p.searchText ||
            (p.latestSnapshotHtml
              ? p.latestSnapshotHtml.replace(/<[^>]+>/g, " ")
              : "") ||
            p.description ||
            "";
          const excerpt =
            extractSearchExcerpt(query, source) ||
            extractSearchExcerpt(query, p.description || "") ||
            (p.description
              ? extractSearchExcerpt(query, p.description)
              : null);
          return { ...p, score: 1000 - i, excerpt };
        })
        .filter(Boolean) as (typeof projects.$inferSelect & {
        score: number;
        excerpt: string | null;
      })[];
    } else {
      const allPublic = await db
        .select()
        .from(projects)
        .where(eq(projects.visibility, "public"));

      results = allPublic
        .map((p) => {
          const source =
            p.searchText ||
            (p.latestSnapshotHtml
              ? p.latestSnapshotHtml.replace(/<[^>]+>/g, " ")
              : "") ||
            p.description ||
            "";
          const score = relevanceScore(
            query,
            p.title,
            p.description,
            source
          );
          const excerpt =
            extractSearchExcerpt(query, source) ||
            extractSearchExcerpt(query, p.description || "");
          return { ...p, score, excerpt };
        })
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);
    }
  } else {
    const recent = await db
      .select()
      .from(projects)
      .where(eq(projects.visibility, "public"))
      .orderBy(desc(projects.updatedAt))
      .limit(24);
    results = recent.map((p) => ({ ...p, score: 0, excerpt: null }));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6 tracking-tight">Search projects</h1>

      <form className="mb-8">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by title, description, or content…"
          className="hq-input py-3 rounded-xl"
          autoFocus
        />
      </form>

      {query && (
        <p className="text-sm text-[var(--hq-muted)] mb-4">
          {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
          {query}&rdquo;
          {usedFts ? " · FTS" : ""}
        </p>
      )}

      {!query && results.length > 0 && (
        <p className="text-sm text-[var(--hq-muted)] mb-4">Recent public projects</p>
      )}

      <div className="space-y-3">
        {results.map((p) => (
          <Link
            key={p.id}
            href={`/project/${encodeURIComponent(p.slug)}`}
            className="block p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors"
          >
            <h2 className="font-medium">{p.title}</h2>
            {query && p.excerpt ? (
              <p className="text-sm text-[var(--hq-muted)] mt-1.5 leading-relaxed">
                {p.excerpt}
              </p>
            ) : p.description ? (
              <p className="text-sm text-[var(--hq-muted)] mt-1 line-clamp-2">
                {p.description}
              </p>
            ) : null}
          </Link>
        ))}
      </div>

      {query && results.length === 0 && (
        <p className="text-center text-[var(--hq-muted)] py-12">
          No public projects matched your search.
        </p>
      )}
    </div>
  );
}
