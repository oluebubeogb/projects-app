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
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
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

  // Create provider once; stable deps
  const provider = useMemo(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || "ws://localhost:1234";

    console.log("[editor] connecting to", wsUrl, "doc=", projectId);

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
  }, [projectId, token, ydoc]);

  useEffect(() => {
    const onStatus = ({ status: s }: { status: string }) => {
      console.log("[editor] status →", s);
      if (s === "connected") setStatus("connected");
      else if (s === "disconnected") setStatus("disconnected");
      else setStatus("connecting");
    };

    const onConnect = () => {
      console.log("[editor] connected");
      setStatus("connected");
    };

    const onDisconnect = () => {
      console.log("[editor] disconnected");
      setStatus("disconnected");
    };

    const onClose = () => {
      console.log("[editor] connection closed");
      setStatus("disconnected");
    };

    const onSynced = () => {
      console.log("[editor] synced");
      setStatus("connected");
    };

    provider.on("status", onStatus);
    provider.on("connect", onConnect);
    provider.on("disconnect", onDisconnect);
    provider.on("close", onClose);
    provider.on("synced", onSynced);

    // Force connect if not already
    if (!provider.isConnected) {
      try {
        provider.connect();
      } catch (e) {
        console.warn("[editor] connect() call failed", e);
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
      // Do NOT destroy on every unmount during HMR — only when component truly unmounts
      // Destroying too aggressively causes forever-connecting loops
    };
  }, [provider, user]);

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
          {status === "disconnected" && (
            <button
              type="button"
              className="text-[var(--hq-accent)] underline ml-1"
              onClick={() => {
                try {
                  provider.connect();
                  setStatus("connecting");
                } catch {
                  /* ignore */
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
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
