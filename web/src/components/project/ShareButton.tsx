"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Link2, Check, Download, ExternalLink } from "lucide-react";

export function ShareButton({
  path,
  title,
}: {
  path: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function copyShort() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function shareProject() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || "Project",
          url: fullUrl,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await copyShort();
    }
    setOpen(false);
  }

  function downloadPdf() {
    // Print dialog as lightweight PDF export
    window.print();
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--hq-hover)] transition-colors"
        title="Share"
      >
        <Share2 size={13} />
        <span className="hidden sm:inline">Share</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-lg border border-[var(--hq-border)] bg-[var(--hq-surface)] shadow-lg z-50 py-1 text-sm">
          <button
            type="button"
            onClick={copyShort}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hq-hover)] text-left"
          >
            {copied ? (
              <Check size={14} className="text-[var(--hq-success)]" />
            ) : (
              <Link2 size={14} />
            )}
            {copied ? "Copied" : "Copy short link"}
          </button>
          <button
            type="button"
            onClick={shareProject}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hq-hover)] text-left"
          >
            <ExternalLink size={14} />
            Share project
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hq-hover)] text-left"
          >
            <Download size={14} />
            Download as PDF
          </button>
        </div>
      )}
    </div>
  );
}
