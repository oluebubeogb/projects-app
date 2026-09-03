"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ForumComposer } from "./ForumComposer";
import { CallPanel } from "@/components/webrtc/CallPanel";
import { Mic } from "lucide-react";

type Post = {
  id: string;
  body: string;
  kind: string;
  mediaPath?: string | null;
  parentId?: string | null;
  createdAt: number;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorColor: string;
};

export function ForumThread({
  forumId,
  initialPosts = [],
  canPost,
}: {
  forumId: string;
  initialPosts?: Post[];
  canPost: boolean;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/forums/${forumId}/posts`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setPosts(data.posts || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [forumId]);

  return (
    <div className="space-y-4">
      <CallPanel kind="forum" contextId={forumId} />

      <div className="space-y-3">
        {posts.length === 0 && (
          <p className="text-sm text-[var(--hq-muted)] py-6 text-center">
            No posts yet. Start the conversation.
          </p>
        )}
        {posts.map((p) => (
          <div
            key={p.id}
            className="flex gap-3 p-3 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)]"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: p.authorColor || "#5C5DE2" }}
            >
              {p.authorName?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link
                  href={`/u/${encodeURIComponent(p.authorUsername || "")}`}
                  className="text-sm font-medium hover:text-[var(--hq-accent)]"
                >
                  {p.authorName}
                </Link>
                <span className="text-[11px] text-[var(--hq-muted)]">
                  {new Date(p.createdAt * 1000).toLocaleString()}
                </span>
                {p.kind === "voice" && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--hq-success)]">
                    <Mic size={11} /> Voice note
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{p.body}</p>
              {p.kind === "voice" && p.mediaPath && (
                <p className="text-xs text-[var(--hq-muted)] mt-1">
                  Attachment: {p.mediaPath} (upload pipeline stub)
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {canPost && (
        <ForumComposer
          forumId={forumId}
          onPosted={(post) => setPosts((prev) => [...prev, post as Post])}
        />
      )}
    </div>
  );
}
