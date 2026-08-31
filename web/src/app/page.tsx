import Link from "next/link";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const publicProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.visibility, "public"))
    .orderBy(desc(projects.updatedAt))
    .limit(12);

  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Build together.{" "}
          <span className="text-[var(--primary)]">In real time.</span>
        </h1>
        <p className="text-lg text-[var(--text-muted)] max-w-2xl mx-auto mb-8">
          Projects lets people collaborate on any topic with a live editor,
          git-like history, and clear attribution of who wrote what.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/search"
            className="px-5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Explore public projects
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-6">
        {[
          {
            title: "Live collaboration",
            body: "See others type in real time. Colored cursors and presence so you always know who is in the room.",
          },
          {
            title: "Public & private",
            body: "Public projects are searchable. Private ones stay off search and need approval or an invite to join.",
          },
          {
            title: "History & commits",
            body: "Git-like commits capture who changed what. Review the changelog anytime.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="p-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]"
          >
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* Recent public */}
      {publicProjects.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Recent public projects</h2>
            <Link
              href="/search"
              className="text-sm text-[var(--primary)] hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicProjects.map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                className="block p-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--primary)] transition-colors shadow-[var(--shadow)]"
              >
                <h3 className="font-medium mb-1 line-clamp-1">{p.title}</h3>
                <p className="text-sm text-[var(--text-muted)] line-clamp-2">
                  {p.description || "No description"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
