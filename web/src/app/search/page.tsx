import Link from "next/link";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { relevanceScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let results: (typeof projects.$inferSelect & { score: number })[] = [];

  if (query) {
    const allPublic = await db
      .select()
      .from(projects)
      .where(eq(projects.visibility, "public"));

    results = allPublic
      .map((p) => ({
        ...p,
        score: relevanceScore(query, p.title, p.description, p.searchText),
      }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  } else {
    const recent = await db
      .select()
      .from(projects)
      .where(eq(projects.visibility, "public"))
      .limit(24);
    results = recent.map((p) => ({ ...p, score: 0 }));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Search projects</h1>

      <form className="mb-8">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by title, description, or content…"
          className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-[var(--shadow)]"
          autoFocus
        />
      </form>

      {query && (
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
          {query}&rdquo;
        </p>
      )}

      {!query && results.length > 0 && (
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Recent public projects
        </p>
      )}

      <div className="space-y-3">
        {results.map((p) => (
          <Link
            key={p.id}
            href={`/p/${p.slug}`}
            className="block p-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--primary)] transition-colors shadow-[var(--shadow)]"
          >
            <h2 className="font-medium">{p.title}</h2>
            {p.description && (
              <p className="text-sm text-[var(--text-muted)] mt-1 line-clamp-2">
                {p.description}
              </p>
            )}
          </Link>
        ))}
      </div>

      {query && results.length === 0 && (
        <p className="text-center text-[var(--text-muted)] py-12">
          No public projects matched your search.
        </p>
      )}
    </div>
  );
}
