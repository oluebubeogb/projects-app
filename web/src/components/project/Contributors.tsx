"use client";

import { useState } from "react";
import Link from "next/link";

type Member = {
  name: string;
  username: string | null;
  color: string;
  role: string;
  userId?: string;
};

export function Contributors({ members }: { members: Member[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!members.length) return null;

  // Owner first, then others — show up to 2 total when collapsed (owner + 1), or owner + 2 others?
  // Spec: "written by then the owner and others retain the 2 names and more than show collapsible"
  // Interpret: show owner always, plus up to 2 others; if more others → see all
  const owners = members.filter((m) => m.role === "owner");
  const others = members.filter((m) => m.role !== "owner");
  const shownOthers = expanded ? others : others.slice(0, 2);
  const hasMore = others.length > 2;

  function Name({ m }: { m: Member }) {
    if (m.username) {
      return (
        <Link
          href={`/u/${encodeURIComponent(m.username)}`}
          className="text-[var(--hq-accent)] hover:underline font-medium"
        >
          {m.name}
        </Link>
      );
    }
    return <span className="font-medium">{m.name}</span>;
  }

  const parts: React.ReactNode[] = [];
  owners.forEach((m, i) => {
    if (i > 0) parts.push(<span key={`oc-${i}`}>, </span>);
    parts.push(
      <span key={`o-${i}`}>
        <Name m={m} />
      </span>
    );
  });
  shownOthers.forEach((m, i) => {
    parts.push(<span key={`sep-${i}`}>{owners.length > 0 || i > 0 ? ", " : ""}</span>);
    parts.push(
      <span key={`c-${i}`}>
        <Name m={m} />
      </span>
    );
  });

  return (
    <div className="text-sm text-[var(--hq-muted)] mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <span>Written by </span>
      {parts}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[var(--hq-accent)] hover:underline ml-1"
        >
          see all ({others.length})
        </button>
      )}
      {expanded && hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[var(--hq-accent)] hover:underline ml-1"
        >
          hide
        </button>
      )}
    </div>
  );
}
