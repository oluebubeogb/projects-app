"use client";

import Link from "next/link";
import {
  FolderOpen,
  Image as ImageIcon,
  MessageSquare,
  HelpCircle,
  Table2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "all", label: "All", icon: FolderOpen },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "forums", label: "Forums", icon: MessageSquare },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "tables", label: "Tables", icon: Table2 },
  { id: "contributors", label: "Contributors", icon: Users },
] as const;

export function SearchTabs({
  active,
  query,
}: {
  active: string;
  query: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--hq-border)] pb-px mb-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        const href = query
          ? `/search?q=${encodeURIComponent(query)}&type=${tab.id}`
          : `/search?type=${tab.id}`;
        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors border-b-2 -mb-px",
              isActive
                ? "border-[var(--hq-accent)] text-[var(--hq-accent)] font-medium"
                : "border-transparent text-[var(--hq-muted)] hover:text-[var(--hq-text)] hover:border-[var(--hq-border)]"
            )}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
