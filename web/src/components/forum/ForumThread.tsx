"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ForumComposer } from "./ForumComposer";
import { CallPanel, playNotificationTone } from "@/components/webrtc/CallPanel";
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
  currentUserId,
}: {
  forumId: string;
  initialPosts?: Post[];
  canPost: boolean;
  currentUserId?: string;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const lastIdRef = useRef<string | null>(initialPosts.length ? initialPosts[initialPosts.length - 1].id : null);

  useEffect(() => {
    let cancelled = false;

    async function load(silent = false) {
      const res = await fetch(`/api/forums/${forumId}/posts`);
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      const list: Post[] = data.posts || [];
      setPosts((prev) => {
        if (silent && list.length > prev.length) {
          const newest = list[list.length - 1];
          if (newest && newest.authorId !== currentUserId && newest.id !== lastIdRef.current) {
            playNotificationTone();
          }
        }
        if (list.length) lastIdRef.current = list[list.length - 1].id;
        return list;
      });
    }

    load();
    const iv = setInterval(() => load(true), 4000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [forumId, currentUserId]);

  return (
    <div className="space-y-4">
      <CallPanel kind="forum" contextId={forumId} />

      <div className="space-y-3">
        {posts.length === 0 && (
          <p className="text-sm text-[var(--hq-muted)] py-6 text-center">
            No posts yet. Start the conversation.
          </p>
        )}
        {posts.map((p) => {
          const mine = currentUserId && p.authorId === currentUserId;
          return (
            <div
              key={p.id}
              className={`flex gap-3 p-3 rounded-[var(--hq-radius)] border border-[var(--hq-border)] bg-[var(--hq-surface)] max-w-[92%] ${mine ? "ml-auto flex-row-reverse" : "mr-auto"}`}
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
                  <audio controls src={p.mediaPath} className="mt-2 h-8 max-w-full" />
                )}
                {(p.kind === "image" || (p.mediaPath && /\.webp$/i.test(p.mediaPath))) && p.mediaPath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mediaPath} alt="" className="mt-2 max-w-full max-h-64 rounded-lg" />
                )}
              </div>
            </div>
          );
        })}
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
