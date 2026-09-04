"use client";

import { useState, useRef, useEffect } from "react";

export function CollapsibleDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Check if content exceeds ~2 lines
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    setNeedsCollapse(el.scrollHeight > lineHeight * 2.5);
  }, [text]);

  if (!text?.trim()) return null;

  return (
    <div className="mt-2">
      <p
        ref={ref}
        className={
          "text-[var(--hq-muted)] project-desc whitespace-pre-wrap" +
          (!expanded && needsCollapse ? " line-clamp-2" : "")
        }
      >
        {text}
      </p>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm text-[var(--hq-accent)] hover:underline mt-1"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
