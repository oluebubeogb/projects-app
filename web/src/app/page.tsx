import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { projects, forums } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import {
  ArrowRight,
  Check,
  GitBranch,
  Globe2,
  LockKeyhole,
  MessageSquare,
  MousePointer2,
  PenLine,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();

  const publicProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.visibility, "public"))
    .orderBy(desc(projects.updatedAt))
    .limit(12);

  const publicForums = await db
    .select()
    .from(forums)
    .where(eq(forums.visibility, "public"))
    .orderBy(desc(forums.updatedAt))
    .limit(12);

  const primaryHref = user ? "/dashboard/new" : "/register";
  const primaryLabel = user ? "Create new project" : "Start building free";
  const finalHref = user ? "/dashboard/new" : "/register";
  const finalLabel = user ? "Create new project" : "Create your workspace";

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-28">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(92,93,226,.16),transparent_68%)] blur-2xl" />
        <div className="pointer-events-none absolute -right-32 top-20 -z-10 h-64 w-64 rounded-full bg-[rgba(32,166,83,.10)] blur-3xl" />

        <div className="mx-auto max-w-4xl text-center">
          <div className="landing-eyebrow mx-auto mb-6 w-fit">
            <Sparkles size={14} />
            A calmer way to build together
          </div>
          <h1 className="landing-title">
            Your ideas deserve a place to
            <span> grow together.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[var(--hq-muted)] sm:text-lg sm:leading-8">
            Projects brings collaborative writing, transparent history, and focused team work into one beautiful workspace — built for research, teams, and universities.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href={primaryHref} className="landing-primary-btn">
              {primaryLabel} <ArrowRight size={17} />
            </Link>
            <Link href="/search" className="landing-secondary-btn">
              Explore public projects
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--hq-muted)]">
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[var(--hq-success)]" /> No setup required</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[var(--hq-success)]" /> Public or private</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[var(--hq-success)]" /> Built for real-time work</span>
          </div>
        </div>

        {/* Product preview */}
        <div className="mx-auto mt-14 max-w-6xl">
          <div className="landing-window">
            <div className="landing-window-top">
              <div className="flex items-center gap-1.5">
                <span className="landing-dot" /><span className="landing-dot" /><span className="landing-dot" />
              </div>
              <div className="landing-window-address">projects / climate-research / overview</div>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="landing-avatar">J</span><span className="landing-avatar landing-avatar-two">A</span>
              </div>
            </div>
            <div className="grid min-h-[330px] grid-cols-12">
              <aside className="hidden border-r border-[var(--hq-border)] bg-[var(--hq-sidebar)] p-4 sm:col-span-3 sm:block">
                <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-[var(--hq-text)]"><GitBranch size={14} /> Climate Research</div>
                <div className="space-y-1 text-xs text-[var(--hq-muted)]">
                  <div className="landing-side-active">Overview</div>
                  <div className="landing-side-item">Literature review</div>
                  <div className="landing-side-item">Methodology</div>
                  <div className="landing-side-item">Findings</div>
                  <div className="landing-side-item">Commit history</div>
                </div>
              </aside>
              <div className="col-span-12 bg-[var(--hq-surface)] p-5 sm:col-span-9 sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-[var(--hq-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--hq-success)]" /> Live session</div>
                    <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Climate Research — Overview</h2>
                  </div>
                  <span className="rounded-full border border-[var(--hq-border)] px-2.5 py-1 text-[10px] text-[var(--hq-muted)]">Saved 12s ago</span>
                </div>
                <div className="space-y-3 text-sm leading-7 text-[var(--hq-muted)]">
                  <p className="max-w-2xl"><span className="font-medium text-[var(--hq-text)]">Project objective.</span> Explore how local climate patterns affect agricultural productivity and document findings in one shared workspace.</p>
                  <div className="landing-highlight max-w-2xl">Teams can write, review, and refine the same document without losing track of who changed what.</div>
                  <div className="relative max-w-2xl">
                    <span>Our approach combines field observations, structured notes, and transparent revision history for every major section.</span>
                    <span className="landing-cursor"><MousePointer2 size={12} /> Ada</span>
                  </div>
                </div>
                <div className="mt-7 flex flex-wrap gap-2">
                  <span className="landing-chip"><Users size={13} /> 4 collaborators</span>
                  <span className="landing-chip"><GitBranch size={13} /> 18 commits</span>
                  <span className="landing-chip"><MessageSquare size={13} /> 7 discussions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip — Work live / Keep the trail / Control access */}
      <section className="border-y border-[var(--hq-border)] bg-[var(--hq-sidebar)]/70">
        <div className="mx-auto grid max-w-7xl gap-px px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            { icon: Zap, title: "Work live", body: "Edit together with presence, cursors, and instant updates." },
            { icon: GitBranch, title: "Keep the trail", body: "Git-like commits make changes understandable and attributable." },
            { icon: LockKeyhole, title: "Control access", body: "Choose public visibility, private access, invites, and approvals." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 px-2 py-7 sm:px-7">
              <div className="landing-icon-box"><Icon size={18} /></div>
              <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--hq-muted)]">{body}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Visual trio */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-10 max-w-2xl">
          <div className="landing-kicker"><Sparkles size={15} /> Built for clarity</div>
          <h2 className="landing-section-title">See the workspace at a glance</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { src: "/landing/collab-live.png", alt: "Live collaborative editing", caption: "Write together in real time" },
            { src: "/landing/commit-trail.png", alt: "Transparent commit history", caption: "Every change leaves a trail" },
            { src: "/landing/forums-join.png", alt: "Public forums and discussions", caption: "Discuss in public forums" },
          ].map((item) => (
            <figure key={item.src} className="overflow-hidden rounded-2xl border border-[var(--hq-border)] bg-[var(--hq-surface)] shadow-[var(--hq-shadow)]">
              <div className="relative aspect-[5/3] bg-[var(--hq-bg)]">
                <Image src={item.src} alt={item.alt} fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
              </div>
              <figcaption className="px-4 py-3 text-sm font-medium text-[var(--hq-text)]">{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Value proposition */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
        <div>
          <div className="landing-kicker"><PenLine size={15} /> Everything stays connected</div>
          <h2 className="landing-section-title">Less hunting. More making.</h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--hq-muted)] sm:text-base">
            Stop passing versions around or wondering which document is current. Keep the project, people, conversations, and history close to the work.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [Globe2, "Discoverable work", "Share knowledge through searchable public projects."],
              [LockKeyhole, "Private by default", "Keep sensitive work behind invites and approvals."],
              [Users, "Clear attribution", "Know who contributed to the work and when."],
              [GitBranch, "Revision confidence", "Review commits instead of guessing what changed."],
            ].map(([Icon, title, body]) => {
              const FeatureIcon = Icon as typeof Globe2;
              return (
                <div key={title as string} className="landing-mini-card">
                  <FeatureIcon size={16} />
                  <div>
                    <div className="text-sm font-medium">{title as string}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--hq-muted)]">{body as string}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="landing-quote-card">
          <div className="landing-quote-mark">“</div>
          <p className="relative z-[1] text-lg font-medium leading-8 tracking-tight sm:text-xl">
            We finally stopped chasing document versions. The project, the people, and the history live in one place — and everyone can see the trail.
          </p>
          <div className="relative z-[1] mt-8 flex items-center gap-3">
            <div className="landing-quote-avatar">R</div>
            <div>
              <div className="text-sm font-semibold">Research lead</div>
              <div className="text-xs text-[var(--hq-muted)]">University collaboration group</div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent public projects */}
      {publicProjects.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="landing-kicker"><Globe2 size={15} /> Discover</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Recent public projects</h2>
            </div>
            <Link href="/search" className="hidden items-center gap-1.5 text-sm font-medium text-[var(--hq-accent)] hover:gap-2.5 sm:flex">View all <ArrowRight size={15} /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicProjects.map((p, index) => (
              <Link key={p.id} href={`/project/${encodeURIComponent(p.slug)}`} className="landing-project-card group">
                <div className="mb-5 flex items-center justify-between">
                  <span className="landing-project-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="landing-project-arrow"><ArrowRight size={14} /></span>
                </div>
                <h3 className="line-clamp-1 text-base font-semibold tracking-tight group-hover:text-[var(--hq-accent)]">{p.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--hq-muted)]">{p.description || "No description"}</p>
                <div className="mt-5 flex items-center gap-2 text-[11px] text-[var(--hq-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--hq-success)]" /> Public project
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Join a public forum — same grid as projects, ordered by last edit */}
      {publicForums.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="landing-kicker"><MessageSquare size={15} /> Community</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Join a public forum</h2>
            </div>
            <Link href="/forums" className="hidden items-center gap-1.5 text-sm font-medium text-[var(--hq-accent)] hover:gap-2.5 sm:flex">View all <ArrowRight size={15} /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicForums.map((f, index) => (
              <Link key={f.id} href={`/forums/${encodeURIComponent(f.id)}`} className="landing-project-card group">
                <div className="mb-5 flex items-center justify-between">
                  <span className="landing-project-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="landing-project-arrow"><ArrowRight size={14} /></span>
                </div>
                <h3 className="line-clamp-1 text-base font-semibold tracking-tight group-hover:text-[var(--hq-accent)]">{f.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--hq-muted)]">{f.description || "No description"}</p>
                <div className="mt-5 flex items-center gap-2 text-[11px] text-[var(--hq-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--hq-accent)]" /> Public forum
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="mx-4 mb-10 overflow-hidden rounded-3xl border border-[rgba(92,93,226,.22)] bg-[linear-gradient(135deg,rgba(92,93,226,.12),rgba(32,166,83,.07))] sm:mx-6 lg:mx-auto lg:max-w-7xl">
        <div className="relative px-6 py-14 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(92,93,226,.10)] blur-3xl" />
          <div className="relative">
            <div className="landing-eyebrow mx-auto mb-5 w-fit"><Sparkles size={14} /> Ready when you are</div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Make the next project together.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--hq-muted)] sm:text-base">
              {user
                ? "Open a new workspace, invite collaborators, and keep writing with a clear trail."
                : "Create a workspace, invite your collaborators, and turn scattered ideas into work you can actually build on."}
            </p>
            <Link href={finalHref} className="landing-primary-btn mx-auto mt-8 w-fit">
              {finalLabel} <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
