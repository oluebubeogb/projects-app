import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const memberships = await db
    .select({
      project: projects,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id))
    .orderBy(desc(projects.updatedAt));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Your projects</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Welcome back, {user.name}
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
        >
          New project
        </Link>
      </div>

      {memberships.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-[var(--radius)]">
          <p className="text-[var(--text-muted)] mb-4">
            You don&apos;t have any projects yet.
          </p>
          <Link
            href="/dashboard/new"
            className="text-[var(--primary)] font-medium hover:underline"
          >
            Create your first project →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberships.map(({ project, role }) => (
            <Link
              key={project.id}
              href={`/p/${project.slug}`}
              className="block p-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--primary)] transition-colors shadow-[var(--shadow)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-semibold line-clamp-1">{project.title}</h2>
                <span
                  className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${
                    project.visibility === "private"
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  }`}
                >
                  {project.visibility}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-3">
                {project.description || "No description"}
              </p>
              <p className="text-xs text-[var(--text-muted)] capitalize">
                {role}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
