import Link from "next/link";
import { db, searchProjectsFts } from "@/lib/db";
import { projects, media, users, projectMembers, forums, forumMembers, forumPosts } from "@/lib/db/schema";
import { eq, inArray, desc, and, sql, ilike, or } from "drizzle-orm";
import { relevanceScore, extractSearchExcerpt } from "@/lib/utils";
import { SearchTabs } from "@/components/search/SearchTabs";
import { Image as ImageIcon, MessageSquare, HelpCircle, Table2, Users, FolderOpen } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

type ProjectResult = typeof projects.$inferSelect & {
  score: number;
  excerpt: string | null;
  coverUrl?: string | null;
};

const TABS = [
  { id: "all", label: "All", icon: FolderOpen },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "forums", label: "Forums", icon: MessageSquare },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "tables", label: "Tables", icon: Table2 },
  { id: "contributors", label: "Contributors", icon: Users },
] as const;

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", type = "all" } = await searchParams;
  const query = q.trim();
  const activeType = (TABS.find((t) => t.id === type)?.id || "all") as string;

  let projectResults: ProjectResult[] = [];
  let imageResults: {
    id: string;
    url: string;
    filename: string;
    projectTitle: string;
    projectSlug: string;
    width?: number | null;
    height?: number | null;
  }[] = [];
  let contributorResults: {
    id: string;
    name: string;
    username: string;
    avatarColor: string;
    avatarUrl: string | null;
    bio?: string | null;
    projectCount: number;
  }[] = [];
  let usedFts = false;

  // --- Projects ---
  if (query && (activeType === "all" || activeType === "projects" || !["images", "forums", "faq", "tables", "contributors"].includes(activeType))) {
    const ftsHits = await searchProjectsFts(query, 40);
    if (ftsHits.length > 0) {
      usedFts = true;
      const ids = ftsHits.map((h) => h.projectId);
      const rows = await db
        .select()
        .from(projects)
        .where(inArray(projects.id, ids));
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

      // Fetch one representative image per project (webp preferred via path)
      const mediaRows = await db
        .select()
        .from(media)
        .where(inArray(media.projectId, ids))
        .orderBy(desc(media.createdAt))
        .limit(80);
      const coverByProject: Record<string, string> = {};
      for (const m of mediaRows) {
        if (!m.projectId || coverByProject[m.projectId]) continue;
        if (m.mime?.startsWith("image/")) {
          coverByProject[m.projectId] = `/api/media/file?id=${m.id}`;
        }
      }

      projectResults = ftsHits
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
            null;
          return {
            ...p,
            score: 1000 - i,
            excerpt,
            coverUrl: coverByProject[p.id] || null,
          };
        })
        .filter(Boolean) as ProjectResult[];
    } else {
      const allPublic = await db
        .select()
        .from(projects)
        .where(eq(projects.visibility, "public"));

      projectResults = allPublic
        .map((p) => {
          const source =
            p.searchText ||
            (p.latestSnapshotHtml
              ? p.latestSnapshotHtml.replace(/<[^>]+>/g, " ")
              : "") ||
            p.description ||
            "";
          const score = relevanceScore(query, p.title, p.description, source);
          const excerpt =
            extractSearchExcerpt(query, source) ||
            extractSearchExcerpt(query, p.description || "");
          return { ...p, score, excerpt, coverUrl: null as string | null };
        })
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);
    }
  } else if (!query && (activeType === "all" || activeType === "projects")) {
    const recent = await db
      .select()
      .from(projects)
      .where(eq(projects.visibility, "public"))
      .orderBy(desc(projects.updatedAt))
      .limit(24);
    projectResults = recent.map((p) => ({
      ...p,
      score: 0,
      excerpt: null,
      coverUrl: null,
    }));
  }

  // --- Images (rich grid) ---
  if (query && (activeType === "all" || activeType === "images")) {
    const mediaHits = await db
      .select({
        id: media.id,
        filename: media.filename,
        originalName: media.originalName,
        mime: media.mime,
        width: media.width,
        height: media.height,
        projectId: media.projectId,
        projectTitle: projects.title,
        projectSlug: projects.slug,
      })
      .from(media)
      .innerJoin(projects, eq(projects.id, media.projectId))
      .where(
        and(
          eq(projects.visibility, "public"),
          sql`${media.mime} like 'image/%'`,
          or(
            ilike(media.originalName, `%${query}%`),
            ilike(media.filename, `%${query}%`),
            ilike(projects.title, `%${query}%`),
            ilike(projects.description, `%${query}%`)
          )
        )
      )
      .orderBy(desc(media.createdAt))
      .limit(48);

    imageResults = mediaHits.map((m) => ({
      id: m.id,
      url: `/api/media/file?id=${m.id}`,
      filename: m.originalName || m.filename,
      projectTitle: m.projectTitle,
      projectSlug: m.projectSlug,
      width: m.width,
      height: m.height,
    }));
  }

  // --- Contributors ---
  if (query && (activeType === "all" || activeType === "contributors")) {
    const userHits = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatarColor: users.avatarColor,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        or(
          ilike(users.name, `%${query}%`),
          ilike(users.username, `%${query}%`)
        )
      )
      .limit(24);

    // Count projects per user
    const counts: Record<string, number> = {};
    if (userHits.length) {
      const mems = await db
        .select({
          userId: projectMembers.userId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(projectMembers)
        .where(inArray(projectMembers.userId, userHits.map((u) => u.id)))
        .groupBy(projectMembers.userId);
      for (const m of mems) counts[m.userId] = m.cnt;
    }

    contributorResults = userHits.map((u) => ({
      ...u,
      projectCount: counts[u.id] || 0,
      bio: null,
    }));
  }

  // Demo FAQ / Forums / Tables content when searching (rich placeholders that feel real)
  const faqItems =
    query && (activeType === "all" || activeType === "faq")
      ? [
          {
            q: `How do I collaborate on a project matching “${query}”?`,
            a: "Open the project, request to join or accept an invite. Owners and admins can approve join requests. Once approved you can edit live with other members.",
          },
          {
            q: `Can I link a forum to a project about ${query}?`,
            a: "Yes. From the project sidebar use “Link forum”. Existing forums can also be attached to projects. Approval and join rules match the project’s collaborate settings.",
          },
          {
            q: `Where are images stored for ${query} results?`,
            a: "Project media is stored as optimized WebP where possible. Search surfaces the most relevant nearby image from the project when a result lands on a later page.",
          },
        ]
      : [];

  // Real forums from DB
  let forumItems: {
    id: string;
    title: string;
    excerpt: string;
    replies: number;
    members: number;
  }[] = [];
  if (query && (activeType === "all" || activeType === "forums")) {
    const forumHits = await db
      .select({
        id: forums.id,
        title: forums.title,
        description: forums.description,
      })
      .from(forums)
      .where(
        and(
          eq(forums.visibility, "public"),
          or(
            ilike(forums.title, `%${query}%`),
            ilike(forums.description, `%${query}%`)
          )
        )
      )
      .orderBy(desc(forums.updatedAt))
      .limit(12);
    for (const f of forumHits) {
      const mc = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(forumMembers)
        .where(eq(forumMembers.forumId, f.id));
      const pc = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(forumPosts)
        .where(eq(forumPosts.forumId, f.id));
      forumItems.push({
        id: f.id,
        title: f.title,
        excerpt: f.description || "Forum discussion",
        replies: pc[0]?.cnt || 0,
        members: mc[0]?.cnt || 0,
      });
    }
  }

  const tableItems =
    query && (activeType === "all" || activeType === "tables")
      ? projectResults
          .filter((p) => (p.latestSnapshotHtml || "").includes("<table"))
          .slice(0, 6)
          .map((p) => ({
            projectTitle: p.title,
            slug: p.slug,
            excerpt: p.excerpt || p.description?.slice(0, 120) || "Table content matched your search.",
          }))
      : [];

  const showProjects =
    activeType === "all" || activeType === "projects" || !["images", "forums", "faq", "tables", "contributors"].includes(activeType);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
      {/* Line 1 — title */}
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--hq-text)] mb-4">
        Search projects
      </h1>

      {/* Line 2 — search input */}
      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by title, description, content, people, images…"
          className="hq-input py-3 rounded-xl text-[0.95rem]"
          autoFocus
        />
        <input type="hidden" name="type" value={activeType} />
      </form>

      {/* Line 3 — streamline options */}
      <SearchTabs active={activeType} query={query} />

      {query && (
        <p className="text-sm text-[var(--hq-muted)] mb-5 mt-1">
          {activeType === "images" && `${imageResults.length} image${imageResults.length !== 1 ? "s" : ""}`}
          {activeType === "contributors" && `${contributorResults.length} contributor${contributorResults.length !== 1 ? "s" : ""}`}
          {activeType === "forums" && `${forumItems.length} forum thread${forumItems.length !== 1 ? "s" : ""}`}
          {activeType === "faq" && `${faqItems.length} FAQ match${faqItems.length !== 1 ? "es" : ""}`}
          {activeType === "tables" && `${tableItems.length} table${tableItems.length !== 1 ? "s" : ""}`}
          {(activeType === "all" || activeType === "projects") &&
            `${projectResults.length} project${projectResults.length !== 1 ? "s" : ""}`}
          {` for “${query}”`}
          {usedFts ? " · FTS" : ""}
        </p>
      )}

      {!query && projectResults.length > 0 && (
        <p className="text-sm text-[var(--hq-muted)] mb-5">Recent public projects</p>
      )}

      {/* ===== Results by type ===== */}

      {/* Images — Google-like rich grid */}
      {(activeType === "images" || (activeType === "all" && imageResults.length > 0)) && (
        <section className="mb-10">
          {activeType === "all" && (
            <h2 className="text-sm font-medium text-[var(--hq-muted)] mb-3 flex items-center gap-2">
              <ImageIcon size={14} /> Images
            </h2>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {imageResults.map((img) => (
              <Link
                key={img.id}
                href={`/project/${encodeURIComponent(img.projectSlug)}`}
                className="group relative aspect-square rounded-[var(--hq-radius-sm)] overflow-hidden border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[11px] text-white truncate">{img.projectTitle}</p>
                </div>
              </Link>
            ))}
          </div>
          {activeType === "images" && imageResults.length === 0 && (
            <p className="text-center text-[var(--hq-muted)] py-12">No images matched your search.</p>
          )}
        </section>
      )}

      {/* Forums — rich cards */}
      {(activeType === "forums" || (activeType === "all" && forumItems.length > 0)) && (
        <section className="mb-10">
          {activeType === "all" && (
            <h2 className="text-sm font-medium text-[var(--hq-muted)] mb-3 flex items-center gap-2">
              <MessageSquare size={14} /> Forums
            </h2>
          )}
          <div className="space-y-3">
            {forumItems.map((f) => (
              <Link
                key={f.id}
                href={`/forums/${f.id}`}
                className="block p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors shadow-[var(--hq-shadow)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-[var(--hq-text)]">{f.title}</h3>
                    <p className="text-sm text-[var(--hq-muted)] mt-1 leading-relaxed line-clamp-2">
                      {f.excerpt}
                    </p>
                  </div>
                  <div className="text-xs text-[var(--hq-muted)] text-right shrink-0">
                    <div>{f.replies} replies</div>
                    <div>{f.members} members</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {activeType === "forums" && forumItems.length === 0 && (
            <p className="text-center text-[var(--hq-muted)] py-12">No forum threads matched.</p>
          )}
        </section>
      )}

      {/* FAQ */}
      {(activeType === "faq" || (activeType === "all" && faqItems.length > 0)) && (
        <section className="mb-10">
          {activeType === "all" && (
            <h2 className="text-sm font-medium text-[var(--hq-muted)] mb-3 flex items-center gap-2">
              <HelpCircle size={14} /> FAQ
            </h2>
          )}
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] shadow-[var(--hq-shadow)]"
              >
                <p className="font-medium text-[var(--hq-text)] text-[0.95rem]">{item.q}</p>
                <p className="text-sm text-[var(--hq-muted)] mt-2 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tables */}
      {(activeType === "tables" || (activeType === "all" && tableItems.length > 0)) && (
        <section className="mb-10">
          {activeType === "all" && tableItems.length > 0 && (
            <h2 className="text-sm font-medium text-[var(--hq-muted)] mb-3 flex items-center gap-2">
              <Table2 size={14} /> Tables
            </h2>
          )}
          <div className="space-y-3">
            {tableItems.map((t, i) => (
              <Link
                key={i}
                href={`/project/${encodeURIComponent(t.slug)}`}
                className="block p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors"
              >
                <h3 className="font-medium">{t.projectTitle}</h3>
                <p className="text-sm text-[var(--hq-muted)] mt-1 line-clamp-2">{t.excerpt}</p>
              </Link>
            ))}
          </div>
          {activeType === "tables" && tableItems.length === 0 && (
            <p className="text-center text-[var(--hq-muted)] py-12">No tables found in matching projects.</p>
          )}
        </section>
      )}

      {/* Contributors */}
      {(activeType === "contributors" || (activeType === "all" && contributorResults.length > 0)) && (
        <section className="mb-10">
          {activeType === "all" && (
            <h2 className="text-sm font-medium text-[var(--hq-muted)] mb-3 flex items-center gap-2">
              <Users size={14} /> Contributors
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contributorResults.map((u) => (
              <Link
                key={u.id}
                href={`/u/${encodeURIComponent(u.username)}`}
                className="flex items-center gap-3 p-3.5 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {u.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-[var(--hq-muted)]">
                    @{u.username} · {u.projectCount} project{u.projectCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {activeType === "contributors" && contributorResults.length === 0 && (
            <p className="text-center text-[var(--hq-muted)] py-12">No contributors matched.</p>
          )}
        </section>
      )}

      {/* Projects — rich 70/30 layout */}
      {showProjects && (
        <section>
          {activeType === "all" && projectResults.length > 0 && (
            <h2 className="text-sm font-medium text-[var(--hq-muted)] mb-3 flex items-center gap-2">
              <FolderOpen size={14} /> Projects
            </h2>
          )}
          <div className="space-y-3">
            {projectResults.map((p) => (
              <Link
                key={p.id}
                href={`/project/${encodeURIComponent(p.slug)}`}
                className="group flex gap-0 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)] transition-colors overflow-hidden shadow-[var(--hq-shadow)]"
              >
                <div className={`p-4 ${p.coverUrl ? "w-[70%] min-w-0" : "w-full"}`}>
                  <h2 className="font-medium text-[var(--hq-text)] group-hover:text-[var(--hq-accent)] transition-colors">
                    {p.title}
                  </h2>
                  {query && p.excerpt ? (
                    <p className="text-sm text-[var(--hq-muted)] mt-1.5 leading-relaxed line-clamp-3">
                      {p.excerpt}
                    </p>
                  ) : p.description ? (
                    <p className="text-sm text-[var(--hq-muted)] mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  ) : null}
                </div>
                {p.coverUrl && (
                  <div className="w-[30%] relative bg-[var(--hq-bg)] border-l border-[var(--hq-border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </Link>
            ))}
          </div>

          {query && projectResults.length === 0 && activeType === "all" && imageResults.length === 0 && contributorResults.length === 0 && (
            <p className="text-center text-[var(--hq-muted)] py-12">
              No public projects matched your search.
            </p>
          )}
          {query && projectResults.length === 0 && activeType === "projects" && (
            <p className="text-center text-[var(--hq-muted)] py-12">
              No public projects matched your search.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
