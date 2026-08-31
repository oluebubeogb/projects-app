import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export async function Header() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <span className="w-7 h-7 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold">
            P
          </span>
          Projects
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/search"
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Search
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/new"
                className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
              >
                New project
              </Link>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: user.avatarColor }}
                title={user.name}
              >
                {user.name[0]?.toUpperCase()}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
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
