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

  const owners = members.filter((m) => m.role === "owner");
  const others = members.filter((m) => m.role !== "owner");
  const shownOthers = expanded ? others : others.slice(0, 2);
  const hasMore = others.length > 2;

  function Name({ m }: { m: Member }) {
    const label = m.username ? `@${m.username}` : m.name;
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

  return (
    <div className="text-sm text-[var(--hq-muted)] mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {owners.map((m, i) => (
        <span key={`o-${i}`}>
          {i > 0 && ", "}
          <Name m={m} />
          <span className="opacity-70"> (owner)</span>
        </span>
      ))}
      {shownOthers.length > 0 && (
        <>
          {owners.length > 0 && <span>·</span>}
          {shownOthers.map((m, i) => (
            <span key={`c-${i}`}>
              {i > 0 && ", "}
              <Name m={m} />
            </span>
          ))}
        </>
      )}
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
