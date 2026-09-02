"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Code,
  Users,
  Eye,
  EyeOff,
  History,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  token: string;
  user: { id: string; name: string; color: string };
  readOnly?: boolean;
  onOpenHistory?: () => void;
  onOpenMedia?: () => void;
};

export function CollaborativeEditor({
  projectId,
  token,
  user,
  readOnly = false,
  onOpenHistory,
  onOpenMedia,
}: Props) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting"
  );
  const [peers, setPeers] = useState<{ name: string; color: string }[]>([]);
  const [showMyInputs, setShowMyInputs] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);

  // Same-origin WebSocket (like collab-editor): wss://current-host/collab
  // Prefer explicit env, otherwise derive from window.location
  const wsUrl = useMemo(() => {
    // 1. Explicit env wins (set in Coolify build args if needed)
    if (process.env.NEXT_PUBLIC_HOCUSPOCUS_URL) {
      return process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
    }

    // 2. Same-origin path — works with Coolify path proxy /collab → collab:1235
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const candidate = `${protocol}//${window.location.host}/collab`;
      console.log("[editor] using same-origin WS", candidate);
      return candidate;
    }

    // 3. Local dev fallback
    return "ws://localhost:1235";
  }, []);

  // Create provider once; stable deps
  const provider = useMemo(() => {
    console.log("[editor] connecting to", wsUrl, "doc=", projectId, {
      envUrl: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ?? "(unset)",
      hasToken: Boolean(token && token.length > 8),
      projectId,
    });

    const p = new HocuspocusProvider({
      url: wsUrl,
      name: projectId,
      token,
      document: ydoc,
      // Auto-reconnect
      forceSyncInterval: 20000,
    });

    providerRef.current = p;
    return p;
  }, [projectId, token, ydoc, wsUrl]);

  useEffect(() => {
    const onStatus = ({ status: s }: { status: string }) => {
      console.log("[editor] status →", s, { wsUrl });
      if (s === "connected") setStatus("connected");
      else if (s === "disconnected") setStatus("disconnected");
      else setStatus("connecting");
    };

    const onConnect = () => {
      console.log("[editor] connected", { wsUrl, projectId });
      setStatus("connected");
    };

    const onDisconnect = ({ event }: { event?: CloseEvent }) => {
      console.warn("[editor] disconnected", {
        code: event?.code,
        reason: event?.reason,
        wasClean: event?.wasClean,
        wsUrl,
      });
      setStatus("disconnected");
    };

    const onClose = ({ event }: { event?: CloseEvent }) => {
      console.warn("[editor] connection closed", {
        code: event?.code,
        reason: event?.reason,
        wasClean: event?.wasClean,
        wsUrl,
      });
      setStatus("disconnected");
    };

    const onSynced = () => {
      console.log("[editor] synced");
      setStatus("connected");
    };

    const onAuthenticationFailed = (data: unknown) => {
      console.error("[editor] authentication failed", data, { wsUrl, projectId });
      setStatus("disconnected");
    };

    const onCloseWithError = (data: unknown) => {
      console.error("[editor] close with error", data, { wsUrl });
      setStatus("disconnected");
    };

    provider.on("status", onStatus);
    provider.on("connect", onConnect);
    provider.on("disconnect", onDisconnect);
    provider.on("close", onClose);
    provider.on("synced", onSynced);
    provider.on("authenticationFailed", onAuthenticationFailed);
    // Some versions emit "close" with error payload
    provider.on("close", onCloseWithError);

    // Force connect if not already
    if (!provider.isConnected) {
      try {
        console.log("[editor] calling provider.connect()", { wsUrl });
        provider.connect();
      } catch (e) {
        console.error("[editor] connect() call failed", e, { wsUrl });
      }
    }

    const awareness = provider.awareness;
    if (awareness) {
      awareness.setLocalStateField("user", {
        name: user.name,
        color: user.color,
        id: user.id,
      });

      const updatePeers = () => {
        const states = Array.from(awareness.getStates().values()) as {
          user?: { name: string; color: string; id?: string };
        }[];
        const list = states
          .filter((s) => s.user && s.user.name !== user.name)
          .map((s) => s.user!);
        setPeers(list);
      };
      awareness.on("change", updatePeers);
      updatePeers();
    }

    return () => {
      provider.off("status", onStatus);
      provider.off("connect", onConnect);
      provider.off("disconnect", onDisconnect);
      provider.off("close", onClose);
      provider.off("synced", onSynced);
      provider.off("authenticationFailed", onAuthenticationFailed);
      provider.off("close", onCloseWithError);
      // Do NOT destroy on every unmount during HMR — only when component truly unmounts
      // Destroying too aggressively causes forever-connecting loops
    };
  }, [provider, user, wsUrl, projectId]);

  // Cleanup on true unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        try {
          providerRef.current.destroy();
        } catch {
          /* ignore */
        }
        providerRef.current = null;
      }
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Yjs handles history
      }),
      Underline,
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "editor-image" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Placeholder.configure({
        placeholder: "Start writing… others will see your changes live.",
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user.name,
          color: user.color,
        },
      }),
    ],
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "ProseMirror focus:outline-none",
          showMyInputs && "show-my-inputs"
        ),
      },
    },
  });


  // Allow MediaLibrary to insert into editor
  useEffect(() => {
    if (!editor) return;
    (window as unknown as { __projectsInsertImage?: (url: string) => void }).__projectsInsertImage = (url: string) => {
      editor.chain().focus().setImage({ src: url }).run();
    };
    return () => {
      delete (window as unknown as { __projectsInsertImage?: (url: string) => void }).__projectsInsertImage;
    };
  }, [editor]);

  // Toggle class on editor when showMyInputs changes
  useEffect(() => {
    if (!editor) return;
    const el = editor.view.dom;
    if (showMyInputs) el.classList.add("show-my-inputs");
    else el.classList.remove("show-my-inputs");
  }, [editor, showMyInputs]);

  const run = useCallback(
    (cmd: string) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      switch (cmd) {
        case "bold":
          chain.toggleBold().run();
          break;
        case "italic":
          chain.toggleItalic().run();
          break;
        case "underline":
          chain.toggleUnderline().run();
          break;
        case "strike":
          chain.toggleStrike().run();
          break;
        case "h1":
          chain.toggleHeading({ level: 1 }).run();
          break;
        case "h2":
          chain.toggleHeading({ level: 2 }).run();
          break;
        case "bullet":
          chain.toggleBulletList().run();
          break;
        case "ordered":
          chain.toggleOrderedList().run();
          break;
        case "quote":
          chain.toggleBlockquote().run();
          break;
        case "code":
          chain.toggleCodeBlock().run();
          break;
        case "h3":
          chain.toggleHeading({ level: 3 }).run();
          break;
        case "hr":
          chain.setHorizontalRule().run();
          break;
        case "link": {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev || "https://");
          if (url === null) break;
          if (url === "") {
            chain.unsetLink().run();
          } else {
            chain.extendMarkRange("link").setLink({ href: url }).run();
          }
          break;
        }
        case "image": {
          const url = window.prompt("Image URL");
          if (url) chain.setImage({ src: url }).run();
          break;
        }
        case "undo":
          chain.undo().run();
          break;
        case "redo":
          chain.redo().run();
          break;
      }
    },
    [editor]
  );

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false;

  const ToolbarBtn = ({
    cmd,
    icon: Icon,
    label,
    active,
  }: {
    cmd: string;
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    active?: boolean;
  }) => (
    <button
      type="button"
      title={label}
      onClick={() => run(cmd)}
      disabled={readOnly}
      className={cn(
        "p-2 rounded-md transition-colors disabled:opacity-40",
        active
          ? "bg-[var(--hq-accent)]/15 text-[var(--hq-accent)]"
          : "hover:bg-[var(--hq-hover)] text-[var(--hq-muted)] hover:text-[var(--hq-text)]"
      )}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex flex-col h-full border border-[var(--hq-border)] rounded-[var(--hq-radius)] bg-[var(--hq-surface)] shadow-sm overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--hq-border)] text-xs text-[var(--hq-muted)] bg-[var(--hq-sidebar)]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full",
              status === "connected"
                ? "bg-[var(--hq-success)]"
                : status === "connecting"
                  ? "bg-[var(--hq-warning)] animate-pulse"
                  : "bg-[var(--hq-danger)]"
            )}
          />
          {status === "connected"
            ? "Live"
            : status === "connecting"
              ? "Connecting…"
              : "Offline"}
          {status !== "connected" && (
            <span
              className="text-[10px] opacity-70 max-w-[180px] truncate hidden sm:inline"
              title={wsUrl}
            >
              → {wsUrl.replace(/^wss?:\/\//, "")}
            </span>
          )}
          {status === "disconnected" && (
            <button
              type="button"
              className="text-[var(--hq-accent)] underline ml-1"
              onClick={() => {
                try {
                  console.log("[editor] manual retry →", wsUrl);
                  provider.connect();
                  setStatus("connecting");
                } catch (e) {
                  console.error("[editor] retry failed", e);
                }
              }}
            >
              Retry
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Show my inputs toggle */}
          {!readOnly && (
            <button
              type="button"
              title={showMyInputs ? "Hide my input highlights" : "Show my inputs"}
              onClick={() => setShowMyInputs((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md transition-colors",
                showMyInputs
                  ? "bg-[var(--hq-success)]/15 text-[var(--hq-success)]"
                  : "hover:bg-[var(--hq-hover)]"
              )}
            >
              {showMyInputs ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="hidden sm:inline">My inputs</span>
            </button>
          )}

          {onOpenHistory && (
            <button
              type="button"
              title="Commit history"
              onClick={onOpenHistory}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--hq-hover)] transition-colors"
            >
              <History size={14} />
              <span className="hidden sm:inline">History</span>
            </button>
          )}

          {onOpenMedia && !readOnly && (
            <button
              type="button"
              title="Media library"
              onClick={onOpenMedia}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--hq-hover)] transition-colors"
            >
              <ImageIcon size={14} />
              <span className="hidden sm:inline">Media</span>
            </button>
          )}

          <div className="flex items-center gap-1 ml-1">
            <Users size={14} className="text-[var(--hq-muted)]" />
            <span
              className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-bold ring-2 ring-[var(--hq-surface)]"
              style={{ backgroundColor: user.color }}
              title={`${user.name} (you)`}
            >
              {user.name[0]?.toUpperCase()}
            </span>
            {peers.map((p, i) => (
              <span
                key={`${p.name}-${i}`}
                className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-bold ring-2 ring-[var(--hq-surface)] -ml-1"
                style={{ backgroundColor: p.color }}
                title={p.name}
              >
                {p.name[0]?.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--hq-border)] bg-[var(--hq-sidebar)]/60">
          <ToolbarBtn cmd="undo" icon={Undo} label="Undo" />
          <ToolbarBtn cmd="redo" icon={Redo} label="Redo" />
          <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
          <ToolbarBtn cmd="bold" icon={Bold} label="Bold" active={isActive("bold")} />
          <ToolbarBtn
            cmd="italic"
            icon={Italic}
            label="Italic"
            active={isActive("italic")}
          />
          <ToolbarBtn
            cmd="underline"
            icon={UnderlineIcon}
            label="Underline"
            active={isActive("underline")}
          />
          <ToolbarBtn
            cmd="strike"
            icon={Strikethrough}
            label="Strike"
            active={isActive("strike")}
          />
          <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
          <ToolbarBtn
            cmd="h1"
            icon={Heading1}
            label="Heading 1"
            active={isActive("heading", { level: 1 })}
          />
          <ToolbarBtn
            cmd="h2"
            icon={Heading2}
            label="Heading 2"
            active={isActive("heading", { level: 2 })}
          />
          <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
          <ToolbarBtn
            cmd="bullet"
            icon={List}
            label="Bullet list"
            active={isActive("bulletList")}
          />
          <ToolbarBtn
            cmd="ordered"
            icon={ListOrdered}
            label="Ordered list"
            active={isActive("orderedList")}
          />
          <ToolbarBtn
            cmd="quote"
            icon={Quote}
            label="Quote"
            active={isActive("blockquote")}
          />
          <ToolbarBtn
            cmd="code"
            icon={Code}
            label="Code block"
            active={isActive("codeBlock")}
          />
          <ToolbarBtn
            cmd="h3"
            icon={Heading3}
            label="Heading 3"
            active={isActive("heading", { level: 3 })}
          />
          <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
          <ToolbarBtn
            cmd="link"
            icon={LinkIcon}
            label="Link"
            active={isActive("link")}
          />
          <ToolbarBtn
            cmd="image"
            icon={ImageIcon}
            label="Insert image by URL"
          />
          <ToolbarBtn
            cmd="hr"
            icon={Minus}
            label="Horizontal rule"
          />
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
