import { db } from "@/lib/db";
import { users, projects, projectMembers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ username: string }> };

export default async function UserProjectsPage({ params }: Props) {
  const { username: raw } = await params;
  const username = (raw || "").trim().toLowerCase();
  const session = await getSessionUser();

  if (!username) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-xl font-bold">User not found</h1>
      </div>
    );
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const profile = rows[0];

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-xl font-bold mb-2">User not found</h1>
        <p className="text-sm text-[var(--hq-muted)]">
          No user with username <code>@{username}</code>.
        </p>
      </div>
    );
  }

  // Projects owned or member of (public, or private if viewer is the user)
  const owned = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      description: projects.description,
      visibility: projects.visibility,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.ownerId, profile.id))
    .orderBy(desc(projects.updatedAt))
    .limit(50);

  const memberOf = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      description: projects.description,
      visibility: projects.visibility,
      updatedAt: projects.updatedAt,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, profile.id))
    .orderBy(desc(projects.updatedAt))
    .limit(50);

  const seen = new Set<string>();
  const list: typeof owned = [];
  for (const p of [...owned, ...memberOf]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    // Hide private unless viewer is the profile owner or a member (simplified: only show public unless session is the user)
    if (p.visibility === "private" && session?.id !== profile.id) continue;
    list.push(p);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="w-14 h-14 rounded-full object-cover border border-[var(--hq-border)]"
          />
        ) : (
          <span
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.name[0]?.toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <p className="text-sm text-[var(--hq-muted)]">@{profile.username}</p>
          {session && session.id !== profile.id && (
            <Link
              href={`/messages?to=${encodeURIComponent(profile.username)}`}
              className="inline-flex mt-3 text-sm px-3 py-1.5 rounded-lg bg-[var(--hq-accent)] text-white hover:bg-[var(--hq-accent-hover)] transition-colors"
            >
              Send message
            </Link>
          )}
        </div>
      </div>

      {profile.bio ? (
        <div className="mb-6 text-sm leading-relaxed text-[var(--hq-text)]">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <span className="group-open:hidden">{profile.bio.length > 180 ? profile.bio.slice(0, 180) + "…" : profile.bio}</span>
              <span className="hidden group-open:inline whitespace-pre-wrap">{profile.bio}</span>
              {profile.bio.length > 180 && (
                <span className="ml-1 text-[var(--hq-accent)] text-xs group-open:hidden">See more</span>
              )}
              {profile.bio.length > 180 && (
                <span className="ml-1 text-[var(--hq-accent)] text-xs hidden group-open:inline">Hide</span>
              )}
            </summary>
          </details>
        </div>
      ) : null}

      {(profile.organization || profile.location) && (
        <p className="text-sm text-[var(--hq-muted)] mb-6">
          {[profile.organization, profile.location].filter(Boolean).join(" · ")}
        </p>
      )}

      <h2 className="text-sm font-semibold text-[var(--hq-muted)] uppercase tracking-wide mb-3">
        Projects
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--hq-muted)]">No public projects yet.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.id}>
              <Link
                href={`/p/${encodeURIComponent(p.slug)}`}
                className="block p-4 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] hover:border-[var(--hq-accent)]/50 transition-colors"
              >
                <div className="font-medium">{p.title}</div>
                {p.description ? (
                  <p className="text-sm text-[var(--hq-muted)] mt-1 line-clamp-2 project-desc">
                    {p.description}
                  </p>
                ) : null}
                <div className="text-xs text-[var(--hq-muted)] mt-2 capitalize">
                  {p.visibility}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
