"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useMemo, useState, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  token: string;
  user: { id: string; name: string; color: string };
  readOnly?: boolean;
  showMyInputs?: boolean;
};

export function CollaborativeEditor({
  projectId,
  token,
  user,
  readOnly = false,
  showMyInputs = false,
}: Props) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting"
  );
  const [peers, setPeers] = useState<{ name: string; color: string }[]>([]);

  const ydoc = useMemo(() => new Y.Doc(), []);

  const provider = useMemo(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || "ws://localhost:1234";
    return new HocuspocusProvider({
      url: wsUrl,
      name: projectId,
      token,
      document: ydoc,
    });
  }, [projectId, token, ydoc]);

  useEffect(() => {
    const onStatus = ({ status: s }: { status: string }) => {
      if (s === "connected") setStatus("connected");
      else if (s === "disconnected") setStatus("disconnected");
      else setStatus("connecting");
    };
    provider.on("status", onStatus);

    const awareness = provider.awareness;
    if (awareness) {
      awareness.setLocalStateField("user", {
        name: user.name,
        color: user.color,
      });

      const updatePeers = () => {
        const states = Array.from(awareness.getStates().values()) as {
          user?: { name: string; color: string };
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
      provider.destroy();
    };
  }, [provider, user]);

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
    editorProps: {
      attributes: {
        class: "ProseMirror focus:outline-none",
      },
    },
  });

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
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
      )}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex flex-col h-full border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg-elevated)] shadow-[var(--shadow)] overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full",
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            )}
          />
          {status === "connected"
            ? "Live"
            : status === "connecting"
              ? "Connecting…"
              : "Offline"}
        </div>
        <div className="flex items-center gap-2">
          <Users size={14} />
          <span>{peers.length + 1} online</span>
          <div className="flex -space-x-1 ml-1">
            <span
              className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 text-[9px] flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: user.color }}
              title={`${user.name} (you)`}
            >
              {user.name[0]?.toUpperCase()}
            </span>
            {peers.slice(0, 5).map((p, i) => (
              <span
                key={i}
                className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 text-[9px] flex items-center justify-center text-white font-bold"
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
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] bg-gray-50/80 dark:bg-gray-900/40">
          <ToolbarBtn cmd="undo" icon={Undo} label="Undo" />
          <ToolbarBtn cmd="redo" icon={Redo} label="Redo" />
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
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
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
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
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
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
