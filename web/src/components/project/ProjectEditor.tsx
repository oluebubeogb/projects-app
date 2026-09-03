"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { CommitHistory } from "./CommitHistory";
import { MediaLibrary } from "./MediaLibrary";
import { InvitePanel } from "./InvitePanel";

const CollaborativeEditor = dynamic(
  () =>
    import("@/components/editor/CollaborativeEditor").then(
      (m) => m.CollaborativeEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] bg-[var(--hq-surface)] flex items-center justify-center text-[var(--hq-muted)] text-sm">
        Loading editor…
      </div>
    ),
  }
);

export function ProjectEditor({
  projectId,
  token,
  user,
  canManage = false,
}: {
  projectId: string;
  token: string;
  user: { id: string; name: string; color: string };
  canManage?: boolean;
}) {
  const [panel, setPanel] = useState<"none" | "history" | "media" | "invite">("none");

  const close = useCallback(() => setPanel("none"), []);

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="flex-1 min-h-0">
        <CollaborativeEditor
          projectId={projectId}
          token={token}
          user={user}
          onOpenHistory={() => setPanel("history")}
          onOpenMedia={() => setPanel("media")}
          onOpenInvite={canManage ? () => setPanel("invite") : undefined}
        />
      </div>

      {panel === "history" && (
        <CommitHistory projectId={projectId} onClose={close} />
      )}
      {panel === "media" && (
        <MediaLibrary projectId={projectId} onClose={close} />
      )}
      {panel === "invite" && canManage && (
        <InvitePanel projectId={projectId} onClose={close} />
      )}
    </div>
  );
}
