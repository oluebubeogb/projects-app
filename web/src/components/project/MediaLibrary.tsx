"use client";

import { useEffect, useState, useRef } from "react";
import { X, Upload, Image as ImageIcon } from "lucide-react";

type MediaItem = {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  url: string;
};

export function MediaLibrary({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/media?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      setItems(data.media || []);
    } catch {
      setError("Failed to load media");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setItems((prev) => [data.media, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function copyUrl(url: string) {
    const full = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(full);
  }

  function insertIntoEditor(url: string) {
    const full = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    const fn = (window as unknown as { __projectsInsertImage?: (u: string) => void }).__projectsInsertImage;
    if (fn) {
      fn(full);
      onClose();
    } else {
      copyUrl(url);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col hq-card shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hq-border)]">
          <h2 className="font-semibold flex items-center gap-2">
            <ImageIcon size={18} /> Media library
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--hq-hover)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--hq-border)]">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onUpload}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="hq-btn hq-btn-primary w-full disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? "Uploading…" : "Upload file"}
          </button>
          {error && <p className="text-xs text-[var(--hq-danger)] mt-2">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-sm text-[var(--hq-muted)] p-2">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[var(--hq-muted)] p-2">No media yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => insertIntoEditor(m.url)}
                  title="Insert into editor (or copy URL)"
                  className="group relative aspect-square rounded-md overflow-hidden border border-[var(--hq-border)] bg-[var(--hq-input-bg)] hover:border-[var(--hq-accent)] transition-colors"
                >
                  {m.mime.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-[var(--hq-muted)] p-2 text-center">
                      {m.originalName}
                    </div>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] text-white px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    Insert
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
