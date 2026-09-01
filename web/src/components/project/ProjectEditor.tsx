"use client";

import dynamic from "next/dynamic";

const CollaborativeEditor = dynamic(
  () =>
    import("@/components/editor/CollaborativeEditor").then(
      (m) => m.CollaborativeEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] text-sm">
        Loading editor…
      </div>
    ),
  }
);

export function ProjectEditor({
  projectId,
  token,
  user,
}: {
  projectId: string;
  token: string;
  user: { id: string; name: string; color: string };
}) {
  return (
    <div className="h-[min(70vh,640px)]">
      <CollaborativeEditor
        projectId={projectId}
        token={token}
        user={user}
      />
    </div>
  );
}
