import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export async function Header() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hq-border)] bg-[var(--hq-sidebar)]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-lg tracking-tight"
        >
          <span className="w-7 h-7 rounded-lg bg-[var(--hq-accent)] text-white flex items-center justify-center text-sm font-bold">
            P
          </span>
          Projects
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3 text-sm">
          <Link
            href="/search"
            className="text-[var(--hq-muted)] hover:text-[var(--hq-text)] transition-colors hidden sm:inline"
          >
            Search
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-[var(--hq-muted)] hover:text-[var(--hq-text)] transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/forums"
                className="text-[var(--hq-muted)] hover:text-[var(--hq-text)] transition-colors hidden md:inline"
              >
                Forums
              </Link>
              <Link
                href="/messages"
                className="text-[var(--hq-muted)] hover:text-[var(--hq-text)] transition-colors hidden md:inline"
              >
                Messages
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-[var(--hq-muted)] hover:text-[var(--hq-text)] transition-colors"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard/new"
                className="px-3 py-1.5 rounded-lg bg-[var(--hq-accent)] text-white text-sm font-medium hover:bg-[var(--hq-accent-hover)] transition-colors"
              >
                New project
              </Link>
              <NotificationBell />
              <ThemeToggle />
              <Link
                href={`/u/${encodeURIComponent(user.username)}`}
                className="flex items-center gap-1.5 group"
                title={user.name}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-transparent group-hover:ring-[var(--hq-accent)]/40 transition"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.name[0]?.toUpperCase()}
                </div>
              </Link>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link
                href="/login"
                className="text-[var(--hq-muted)] hover:text-[var(--hq-text)] transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-lg bg-[var(--hq-accent)] text-white text-sm font-medium hover:bg-[var(--hq-accent-hover)] transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
