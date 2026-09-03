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
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
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
  Link as LinkIcon,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  RemoveFormatting,
  Unlink,
  Video,
  Info,
  SeparatorHorizontal,
  FileCode,
  Type,
  Save,
  ALargeSmall,
  Palette,
  FilePlus,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEXT_COLORS = [
  "#e8eaed",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#78716c",
  "#000000",
  "#ffffff",
];

const BG_COLORS = [
  "transparent",
  "#fef2f2",
  "#fff7ed",
  "#fefce8",
  "#f0fdf4",
  "#f0fdfa",
  "#eff6ff",
  "#f5f3ff",
  "#fdf2f8",
  "#f5f5f4",
  "#1c1f2a",
  "#0f1117",
];

type Props = {
  projectId: string;
  token: string;
  user: { id: string; name: string; color: string };
  readOnly?: boolean;
  onOpenHistory?: () => void;
  onOpenMedia?: () => void;
  onOpenInvite?: () => void;
};

export function CollaborativeEditor({
  projectId,
  token,
  user,
  readOnly = false,
  onOpenHistory,
  onOpenMedia,
  onOpenInvite,
}: Props) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting"
  );
  const [peers, setPeers] = useState<{ name: string; color: string }[]>([]);
  const [showMyInputs, setShowMyInputs] = useState(false);
  const [toolGroup, setToolGroup] = useState<
    "text" | "paragraph" | "align" | "insert" | "media" | "advanced"
  >("text");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);

  const wsUrl = useMemo(() => {
    if (process.env.NEXT_PUBLIC_HOCUSPOCUS_URL) {
      return process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
    }
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/collab`;
    }
    return "ws://localhost:1236";
  }, []);

  const provider = useMemo(() => {
    const p = new HocuspocusProvider({
      url: wsUrl,
      name: projectId,
      token,
      document: ydoc,
      forceSyncInterval: 20000,
    });
    providerRef.current = p;
    return p;
  }, [projectId, token, ydoc, wsUrl]);

  useEffect(() => {
    const onStatus = ({ status: s }: { status: string }) => {
      if (s === "connected") setStatus("connected");
      else if (s === "disconnected") setStatus("disconnected");
      else setStatus("connecting");
    };
    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");
    const onSynced = () => setStatus("connected");
    const onAuthFailed = () => setStatus("disconnected");

    provider.on("status", onStatus);
    provider.on("connect", onConnect);
    provider.on("disconnect", onDisconnect);
    provider.on("synced", onSynced);
    provider.on("authenticationFailed", onAuthFailed);

    if (!provider.isConnected) {
      try {
        provider.connect();
      } catch {
        /* ignore */
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
      provider.off("synced", onSynced);
      provider.off("authenticationFailed", onAuthFailed);
    };
  }, [provider, user, wsUrl, projectId]);

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
        history: false,
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "editor-image" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
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
        class: cn("ProseMirror focus:outline-none", showMyInputs && "show-my-inputs"),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    (window as unknown as { __projectsInsertImage?: (url: string) => void }).__projectsInsertImage =
      (url: string) => {
        editor.chain().focus().setImage({ src: url }).run();
      };
    return () => {
      delete (window as unknown as { __projectsInsertImage?: (url: string) => void })
        .__projectsInsertImage;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const el = editor.view.dom;
    if (showMyInputs) el.classList.add("show-my-inputs");
    else el.classList.remove("show-my-inputs");
  }, [editor, showMyInputs]);

  const doSave = useCallback(async () => {
    if (!editor || readOnly || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const html = editor.getHTML();
      const plainText = editor.getText();
      const res = await fetch("/api/commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: "Manual save",
          html,
          plainText,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSaveMsg("Saved successfully");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
      setTimeout(() => setSaveMsg(null), 3500);
    } finally {
      setSaving(false);
    }
  }, [editor, projectId, readOnly, saving]);

  // Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  const run = useCallback(
    (cmd: string, value?: string) => {
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
        case "h":
          // Single heading style
          if (editor.isActive("heading")) {
            chain.setParagraph().run();
          } else {
            chain.toggleHeading({ level: 2 }).run();
          }
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
        case "hr":
        case "divider":
          chain.setHorizontalRule().run();
          break;
        case "newPage":
          chain
            .setHorizontalRule()
            .insertContent("<p></p>")
            .run();
          break;
        case "link": {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev || "https://");
          if (url === null) break;
          if (url === "") chain.unsetLink().run();
          else chain.extendMarkRange("link").setLink({ href: url }).run();
          break;
        }
        case "image": {
          const url = window.prompt("Image URL");
          if (url) chain.setImage({ src: url }).run();
          break;
        }
        case "video": {
          const url = window.prompt("Video URL (YouTube / Vimeo / direct)");
          if (url) {
            chain
              .focus()
              .insertContent(
                `<p><a href="${url}" target="_blank" rel="noopener">${url}</a></p>`
              )
              .run();
          }
          break;
        }
        case "clearFormat":
          chain.clearNodes().unsetAllMarks().run();
          break;
        case "unlink":
          chain.unsetLink().run();
          break;
        case "alignLeft":
          chain.setTextAlign("left").run();
          break;
        case "alignCenter":
          chain.setTextAlign("center").run();
          break;
        case "alignRight":
          chain.setTextAlign("right").run();
          break;
        case "alignJustify":
          chain.setTextAlign("justify").run();
          break;
        case "paragraph":
          chain.setParagraph().run();
          break;
        case "indent":
          chain.sinkListItem("listItem").run();
          break;
        case "outdent":
          chain.liftListItem("listItem").run();
          break;
        case "infoBlock":
          chain
            .focus()
            .insertContent(
              "<blockquote><p><strong>Info</strong> — add details here.</p></blockquote>"
            )
            .run();
          break;
        case "button": {
          const label = window.prompt("Button label", "Click me");
          const href = window.prompt("Button URL", "https://");
          if (label && href) {
            chain
              .focus()
              .insertContent(`<p><a href="${href}" class="editor-btn">${label}</a></p>`)
              .run();
          }
          break;
        }
        case "faq":
          chain
            .focus()
            .insertContent("<h2>Question?</h2><p>Answer goes here.</p>")
            .run();
          break;
        case "embedHtml": {
          const html = window.prompt("Paste HTML snippet");
          if (html) chain.focus().insertContent(html).run();
          break;
        }
        case "codeInline":
          chain.toggleCode().run();
          break;
        case "undo":
          chain.undo().run();
          break;
        case "redo":
          chain.redo().run();
          break;
        case "fontUp": {
          // Cycle: base -> heading -> larger
          if (editor.isActive("heading", { level: 1 })) {
            // already largest
          } else if (editor.isActive("heading")) {
            chain.toggleHeading({ level: 1 }).run();
          } else {
            chain.toggleHeading({ level: 2 }).run();
          }
          break;
        }
        case "fontDown": {
          if (editor.isActive("heading", { level: 1 })) {
            chain.toggleHeading({ level: 2 }).run();
          } else if (editor.isActive("heading")) {
            chain.setParagraph().run();
          }
          break;
        }
        case "color":
          if (value) chain.setColor(value).run();
          break;
        case "bg":
          if (value === "transparent") chain.unsetHighlight().run();
          else if (value) chain.setHighlight({ color: value }).run();
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
    onClick,
  }: {
    cmd?: string;
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    active?: boolean;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      title={label}
      onClick={() => (onClick ? onClick() : cmd && run(cmd))}
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
    <div className="editor-shell flex flex-col">
      {/* Sticky chrome: status + toolbar */}
      <div className="editor-chrome">
        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--hq-muted)]">
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

          <div className="flex items-center gap-1.5 flex-wrap">
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

            {onOpenInvite && (
              <button
                type="button"
                title="Invite by email"
                onClick={onOpenInvite}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--hq-hover)] transition-colors"
              >
                <Mail size={14} />
                <span className="hidden sm:inline">Invite</span>
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
          <div>
            {/* Row 1: save + undo/redo + groups */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 pt-1 pb-0">
              <ToolbarBtn
                icon={Save}
                label="Save (Ctrl+S)"
                onClick={doSave}
                active={saving}
              />
              <ToolbarBtn cmd="undo" icon={Undo} label="Undo" />
              <ToolbarBtn cmd="redo" icon={Redo} label="Redo" />
              <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
              {(
                [
                  ["text", "Text"],
                  ["paragraph", "Paragraph"],
                  ["align", "Align"],
                  ["insert", "Insert"],
                  ["media", "Media"],
                  ["advanced", "Advanced"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setToolGroup(id)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-px",
                    toolGroup === id
                      ? "border-[var(--hq-accent)] text-[var(--hq-accent)] bg-[var(--hq-surface)]"
                      : "border-transparent text-[var(--hq-muted)] hover:text-[var(--hq-text)] hover:bg-[var(--hq-hover)]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Row 2: tools + save message */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-t border-[var(--hq-border)]/60 min-h-[40px]">
              {saveMsg && (
                <span
                  className={cn(
                    "text-xs mr-2 px-2 py-0.5 rounded",
                    saveMsg.includes("success") || saveMsg === "Saved successfully"
                      ? "text-[var(--hq-success)] bg-[var(--hq-success)]/10"
                      : "text-[var(--hq-danger)] bg-[var(--hq-danger)]/10"
                  )}
                >
                  {saveMsg}
                </span>
              )}
              {toolGroup === "text" && (
                <>
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
                    label="Strikethrough"
                    active={isActive("strike")}
                  />
                  <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
                  <ToolbarBtn
                    cmd="h"
                    icon={Heading2}
                    label="Heading"
                    active={isActive("heading")}
                  />
                  <ToolbarBtn
                    cmd="fontUp"
                    icon={ALargeSmall}
                    label="Larger text"
                  />
                  <ToolbarBtn
                    cmd="fontDown"
                    icon={Type}
                    label="Smaller text"
                  />
                  <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
                  <ToolbarBtn
                    cmd="quote"
                    icon={Quote}
                    label="Quote"
                    active={isActive("blockquote")}
                  />
                  <ToolbarBtn
                    cmd="codeInline"
                    icon={Code}
                    label="Inline code"
                    active={isActive("code")}
                  />
                  <ToolbarBtn cmd="clearFormat" icon={RemoveFormatting} label="Clear formatting" />
                  <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
                  {/* Color */}
                  <div className="flex items-center gap-0.5" title="Text color">
                    <Palette size={14} className="text-[var(--hq-muted)] mr-0.5" />
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="color-swatch"
                        style={{ backgroundColor: c }}
                        title={c}
                        onClick={() => run("color", c)}
                      />
                    ))}
                  </div>
                  <span className="w-px h-5 bg-[var(--hq-border)] mx-1" />
                  {/* Background */}
                  <div className="flex items-center gap-0.5" title="Background color">
                    {BG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="color-swatch"
                        style={{
                          backgroundColor: c === "transparent" ? "transparent" : c,
                          backgroundImage:
                            c === "transparent"
                              ? "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)"
                              : undefined,
                          backgroundSize: "6px 6px",
                          backgroundPosition: "0 0, 3px 3px",
                        }}
                        title={c}
                        onClick={() => run("bg", c)}
                      />
                    ))}
                  </div>
                </>
              )}
              {toolGroup === "paragraph" && (
                <>
                  <ToolbarBtn
                    cmd="paragraph"
                    icon={Type}
                    label="Paragraph"
                    active={isActive("paragraph")}
                  />
                  <ToolbarBtn
                    cmd="h"
                    icon={Heading2}
                    label="Heading"
                    active={isActive("heading")}
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
                    label="Numbered list"
                    active={isActive("orderedList")}
                  />
                  <ToolbarBtn cmd="outdent" icon={IndentDecrease} label="Decrease indent" />
                  <ToolbarBtn cmd="indent" icon={IndentIncrease} label="Increase indent" />
                  <ToolbarBtn cmd="hr" icon={Minus} label="Horizontal rule" />
                </>
              )}
              {toolGroup === "align" && (
                <>
                  <ToolbarBtn
                    cmd="alignLeft"
                    icon={AlignLeft}
                    label="Align left"
                    active={editor?.isActive({ textAlign: "left" })}
                  />
                  <ToolbarBtn
                    cmd="alignCenter"
                    icon={AlignCenter}
                    label="Align center"
                    active={editor?.isActive({ textAlign: "center" })}
                  />
                  <ToolbarBtn
                    cmd="alignRight"
                    icon={AlignRight}
                    label="Align right"
                    active={editor?.isActive({ textAlign: "right" })}
                  />
                  <ToolbarBtn
                    cmd="alignJustify"
                    icon={AlignJustify}
                    label="Justify"
                    active={editor?.isActive({ textAlign: "justify" })}
                  />
                </>
              )}
              {toolGroup === "insert" && (
                <>
                  <ToolbarBtn cmd="link" icon={LinkIcon} label="Link" active={isActive("link")} />
                  <ToolbarBtn cmd="unlink" icon={Unlink} label="Unlink" />
                  <ToolbarBtn cmd="divider" icon={SeparatorHorizontal} label="Divider" />
                  <ToolbarBtn
                    cmd="newPage"
                    icon={FilePlus}
                    label="Insert new page (divider + continue)"
                  />
                  <ToolbarBtn
                    cmd="code"
                    icon={FileCode}
                    label="Code block"
                    active={isActive("codeBlock")}
                  />
                  <ToolbarBtn cmd="embedHtml" icon={Code} label="Embed HTML" />
                </>
              )}
              {toolGroup === "media" && (
                <>
                  <ToolbarBtn cmd="image" icon={ImageIcon} label="Image URL" />
                  <ToolbarBtn cmd="video" icon={Video} label="Video link" />
                  {onOpenMedia && (
                    <button
                      type="button"
                      title="Media library"
                      onClick={onOpenMedia}
                      className="p-2 rounded-md hover:bg-[var(--hq-hover)] text-[var(--hq-muted)] hover:text-[var(--hq-text)]"
                    >
                      <ImageIcon size={16} />
                    </button>
                  )}
                </>
              )}
              {toolGroup === "advanced" && (
                <>
                  <ToolbarBtn
                    cmd="code"
                    icon={FileCode}
                    label="Code block"
                    active={isActive("codeBlock")}
                  />
                  <ToolbarBtn cmd="infoBlock" icon={Info} label="Info block" />
                  <ToolbarBtn cmd="button" icon={LinkIcon} label="Button" />
                  <ToolbarBtn cmd="faq" icon={Quote} label="FAQ block" />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor body — free scrolling document */}
      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
