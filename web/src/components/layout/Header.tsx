import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { LayoutDashboard, Plus, Shield } from "lucide-react";
import { MessagesNav } from "@/components/layout/MessagesNav";
import { ForumsNav } from "@/components/layout/ForumsNav";

export async function Header() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hq-border)] bg-[var(--hq-sidebar)]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <span className="w-7 h-7 rounded-lg bg-[var(--hq-accent)] text-white flex items-center justify-center text-sm font-bold shadow-sm">P</span>
          <span className="leading-tight">
            <span className="font-semibold text-base tracking-tight block">Projects</span>
            <span className="text-[var(--hq-muted)] block" style={{ fontSize: "70%" }}>a CISTECH workspace</span>
          </span>
        </Link>
        <div className="flex-1 min-w-0 max-w-md mx-auto hidden sm:block">
          <HeaderSearch />
        </div>
        <nav className="flex items-center gap-1 sm:gap-1.5 text-sm ml-auto">
          {user ? (
            <>
              <IconNav href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
              <ForumsNav className="hidden md:inline-flex" />
              <MessagesNav className="hidden md:inline-flex" />
              <IconNav href="/dashboard/new" icon={Plus} label="New project" />
              {user.role === "admin" && <IconNav href="/admin" icon={Shield} label="Admin" />}
              <NotificationBell />
              <ThemeToggle />
              <Link href={`/u/${encodeURIComponent(user.username)}`} className="flex items-center gap-1.5 group ml-0.5" title={user.name}>
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[var(--hq-accent)]/40 transition" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-transparent group-hover:ring-[var(--hq-accent)]/40 transition" style={{ backgroundColor: user.avatarColor }}>
                    {user.name[0]?.toUpperCase()}
                  </div>
                )}
              </Link>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link href="/login" className="text-[var(--hq-muted)] hover:text-[var(--hq-text)] transition-colors px-2 py-1">Log in</Link>
              <Link href="/register" className="px-3 py-1.5 rounded-lg bg-[var(--hq-accent)] text-white text-sm font-medium hover:bg-[var(--hq-accent-hover)] transition-colors">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function IconNav({ href, icon: Icon, label, className = "", badge = 0 }: {
  href: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string; className?: string; badge?: number;
}) {
  return (
    <Link href={href} className={`relative group inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--hq-muted)] hover:text-[var(--hq-text)] hover:bg-[var(--hq-hover)] transition-colors ${className}`} aria-label={label}>
      <Icon size={18} />
      {badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--hq-accent)] text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="pointer-events-none absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--hq-elevated)] border border-[var(--hq-border)] px-2 py-1 text-[11px] text-[var(--hq-text)] opacity-0 group-hover:opacity-100 transition-opacity shadow-[var(--hq-shadow-md)] z-50">{label}</span>
    </Link>
  );
}
