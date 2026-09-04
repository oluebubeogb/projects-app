"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Image as ImageIcon,
  Settings,
  ChevronDown,
  Bell,
  Search,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number }>;
  match?: string;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, match: "/admin" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { label: "All projects", href: "/admin/projects", icon: FolderKanban },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Media", href: "/admin/media", icon: ImageIcon },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

/** Contextual secondary nav (HQ Line 2 style) */
function contextFor(pathname: string): { section: string; items: NavItem[] } {
  if (pathname.startsWith("/admin/projects")) {
    return {
      section: "Projects",
      items: [
        { label: "All", href: "/admin/projects" },
        { label: "Public", href: "/admin/projects?vis=public" },
        { label: "Private", href: "/admin/projects?vis=private" },
      ],
    };
  }
  if (pathname.startsWith("/admin/users")) {
    return {
      section: "Users",
      items: [
        { label: "All users", href: "/admin/users" },
        { label: "Admins", href: "/admin/users?role=admin" },
      ],
    };
  }
  if (pathname.startsWith("/admin/media")) {
    return {
      section: "Media",
      items: [{ label: "Library", href: "/admin/media" }],
    };
  }
  if (pathname.startsWith("/admin/settings")) {
    return {
      section: "Settings",
      items: [{ label: "General", href: "/admin/settings" }],
    };
  }
  return {
    section: "Overview",
    items: [
      { label: "Dashboard", href: "/admin" },
      { label: "Projects", href: "/admin/projects" },
      { label: "Users", href: "/admin/users" },
    ],
  };
}

export function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; avatarColor: string; email: string };
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    workspace: true,
    system: true,
  });
  const ctx = useMemo(() => contextFor(pathname), [pathname]);

  function isActive(href: string, exactMatch?: string) {
    if (exactMatch) return pathname === exactMatch;
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--hq-border)] bg-[var(--hq-sidebar)]">
        <div className="px-4 py-4 border-b border-[var(--hq-border)] flex items-center justify-between">
          <Link href="/admin" className="font-bold tracking-tight text-[var(--hq-text)]">
            HQ Admin
          </Link>
          <Link
            href="/dashboard"
            title="Back to app"
            className="p-1 rounded hover:bg-[var(--hq-hover)] text-[var(--hq-muted)]"
          >
            <ArrowLeft size={16} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {NAV.map((group) => (
            <div
              key={group.id}
              className={cn("nav-group", openGroups[group.id] && "is-open")}
            >
              <button
                type="button"
                className="nav-group-toggle w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--hq-muted)] hover:text-[var(--hq-text)] hover:bg-[var(--hq-hover)] rounded-md"
                onClick={() =>
                  setOpenGroups((s) => ({ ...s, [group.id]: !s[group.id] }))
                }
              >
                <span>{group.label}</span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "transition-transform opacity-70",
                    openGroups[group.id] && "rotate-180"
                  )}
                />
              </button>
              {openGroups[group.id] && (
                <div className="flex flex-col gap-0.5 mb-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href, item.match);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                          active
                            ? "bg-[var(--hq-accent)]/15 text-[var(--hq-accent)]"
                            : "text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)]"
                        )}
                      >
                        {Icon ? <Icon size={15} /> : null}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--hq-border)] flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: user.avatarColor }}
          >
            {user.name[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[10px] text-[var(--hq-muted)] truncate">{user.email}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual line 2 */}
        <div className="border-b border-[var(--hq-border)] bg-[var(--hq-surface)] px-4 h-11 flex items-center gap-1 overflow-x-auto">
          <span className="text-xs font-semibold text-[var(--hq-muted)] uppercase tracking-wide mr-2 shrink-0">
            {ctx.section}
          </span>
          {ctx.items.map((item) => {
            const active =
              pathname + (typeof window !== "undefined" ? window.location.search : "") ===
                item.href ||
              (item.href.indexOf("?") === -1 && pathname === item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-[var(--hq-accent)]/15 text-[var(--hq-accent)]"
                    : "text-[var(--hq-muted)] hover:bg-[var(--hq-hover)] hover:text-[var(--hq-text)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Link
              href="/search"
              className="p-1.5 rounded-md text-[var(--hq-muted)] hover:bg-[var(--hq-hover)]"
              title="Search"
            >
              <Search size={15} />
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-[var(--hq-muted)] hover:text-[var(--hq-text)]"
            >
              App
            </Link>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
