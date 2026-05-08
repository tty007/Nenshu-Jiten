"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Highlight } from "@tiptap/extension-highlight";
import { CellSelection } from "@tiptap/pm/tables";

/** TableCell / TableHeader 共通の「背景色・文字色」属性。inline style で出力。 */
function cellColorAttributes() {
  return {
    backgroundColor: {
      default: null as string | null,
      parseHTML: (el: HTMLElement) =>
        el.style.backgroundColor || el.getAttribute("data-bg-color") || null,
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.backgroundColor
          ? {
              style: `background-color: ${attrs.backgroundColor}`,
              "data-bg-color": String(attrs.backgroundColor),
            }
          : {},
    },
    textColor: {
      default: null as string | null,
      parseHTML: (el: HTMLElement) =>
        el.style.color || el.getAttribute("data-text-color") || null,
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.textColor
          ? {
              style: `color: ${attrs.textColor}`,
              "data-text-color": String(attrs.textColor),
            }
          : {},
    },
  };
}
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Unlink,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Lock,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SlashCommand, type SlashRange } from "./slash-command-extension";
import { AiWriteDialog } from "./AiWriteDialog";
import { FaqItem, FaqSection, FaqSummary } from "./faq-extension";
import { MemberOnly } from "./member-only-extension";
import { TableScrollHint } from "@/components/articles/TableScrollHint";
import { ArticleBodyStyles } from "@/components/articles/ArticleBodyStyles";

export type EditorHandle = {
  /** 末尾に HTML を追記 */
  appendContent: (html: string) => void;
  /** エディタ全体を HTML で置き換え */
  setContent: (html: string) => void;
  /** カーソル位置に HTML を挿入 */
  insertAtCursor: (html: string) => void;
};

type Props = {
  initialContent?: string | object | null;
  onUpdate?: (payload: { html: string; json: unknown }) => void;
  placeholder?: string;
  /** AI 執筆機能を使う場合は articleId と紐付き企業数を渡す */
  articleId?: string;
  companyCount?: number;
  /** 親コンポーネントへ editor 制御ハンドルを渡す（外部から内容を差し替えるため） */
  onReady?: (handle: EditorHandle) => void;
};

export function TipTapEditor({
  initialContent,
  onUpdate,
  placeholder = "本文を書きはじめる… （空行で / を入力するとブロック挿入メニュー）",
  articleId,
  companyCount = 0,
  onReady,
}: Props) {
  // AI 執筆ダイアログ状態
  const [aiOpen, setAiOpen] = useState(false);
  // スラッシュコマンド時の editor / range を保持（モーダル閉じても挿入位置を維持）
  const aiTriggerRef = useRef<{ editor: Editor; range: SlashRange } | null>(null);


  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-brand-600 underline underline-offset-2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-md" },
        inline: false,
        allowBase64: false,
      }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "tiptap-table" } }),
      // <tr> / <td> / <th> の class・色属性を保持
      TableRow.extend({
        addAttributes() {
          return {
            class: {
              default: null,
              parseHTML: (el) => el.getAttribute("class"),
              renderHTML: (attrs) =>
                attrs.class ? { class: attrs.class as string } : {},
            },
          };
        },
      }),
      TableHeader.extend({
        addAttributes() {
          return {
            ...(this.parent?.() ?? {}),
            ...cellColorAttributes(),
          };
        },
      }),
      TableCell.extend({
        addAttributes() {
          return {
            ...(this.parent?.() ?? {}),
            ...cellColorAttributes(),
            class: {
              default: null,
              parseHTML: (el) => el.getAttribute("class"),
              renderHTML: (attrs) =>
                attrs.class ? { class: attrs.class as string } : {},
            },
          };
        },
      }),
      Highlight.configure({
        HTMLAttributes: { class: "tiptap-mark" },
      }),
      FaqSection,
      FaqItem,
      FaqSummary,
      MemberOnly,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "見出し";
          return placeholder;
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      // articleId が渡されている時だけ /ai を有効化
      articleId
        ? SlashCommand.configure({
            onAiWrite: (editor, range) => {
              aiTriggerRef.current = { editor, range };
              setAiOpen(true);
            },
          })
        : SlashCommand,
    ],
    content: initialContent ?? "",
    immediatelyRender: false,
    onUpdate({ editor }) {
      onUpdate?.({
        html: editor.getHTML(),
        json: editor.getJSON(),
      });
    },
    editorProps: {
      attributes: {
        class:
          "tiptap-content focus:outline-none leading-relaxed text-[1.0625rem] text-ink min-h-[60vh]",
      },
    },
  });

  const handleInsertFromAi = (html: string) => {
    const trigger = aiTriggerRef.current;
    if (!trigger) return;
    // range の位置に挿入（複数行の HTML をペースト）
    trigger.editor
      .chain()
      .focus()
      .insertContentAt(trigger.range, html, {
        parseOptions: { preserveWhitespace: false },
      })
      .run();
  };

  // 親へ EditorHandle を渡す（editor が初期化済みになったタイミングで一度だけ）
  const onReadyCalled = useRef(false);
  useEffect(() => {
    if (!editor || !onReady || onReadyCalled.current) return;
    onReadyCalled.current = true;
    onReady({
      appendContent: (html: string) => {
        editor
          .chain()
          .focus("end")
          .insertContentAt(editor.state.doc.content.size, html, {
            parseOptions: { preserveWhitespace: false },
          })
          .run();
      },
      setContent: (html: string) => {
        editor.commands.setContent(html, { emitUpdate: true });
      },
      insertAtCursor: (html: string) => {
        editor
          .chain()
          .focus()
          .insertContent(html, {
            parseOptions: { preserveWhitespace: false },
          })
          .run();
      },
    });
  }, [editor, onReady]);

  return (
    <div className="relative">
      {editor && <FloatingBubbleMenu editor={editor} />}
      {editor && <CellColorBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
      <ArticleBodyStyles />
      <EditorStyles />
      <TableScrollHint selector=".tiptap-content" />
      {articleId && (
        <AiWriteDialog
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          companyCount={companyCount}
          articleId={articleId}
          onInsert={handleInsertFromAi}
        />
      )}
    </div>
  );
}

// =====================================================================
// 文字を選択した時に上に出るバブルツールバー
// =====================================================================

function FloatingBubbleMenu({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("リンク URL を入力:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, target: "_blank" })
      .run();
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, from, to }: { editor: Editor; from: number; to: number }) => {
        if (from === to) return false;
        if (editor.isActive("image")) return false;
        // セル選択中は専用カラーメニュー（CellColorBubbleMenu）に譲る
        if (editor.state.selection instanceof CellSelection) return false;
        return true;
      }}
      options={{
        placement: "top",
        offset: 8,
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-surface-border bg-white p-1 shadow-lg">
        <ToolBtn
          active={editor.isActive("paragraph") && !editor.isActive("heading")}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="段落"
          icon={<Type className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="見出し 1"
          icon={<Heading1 className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="見出し 2"
          icon={<Heading2 className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="見出し 3"
          icon={<Heading3 className="h-3.5 w-3.5" />}
        />
        <Separator />
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="太字 (⌘B)"
          icon={<Bold className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (⌘I)"
          icon={<Italic className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="取り消し線"
          icon={<Strikethrough className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="インラインコード"
          icon={<Code className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="蛍光ペン（黄）"
          icon={<Highlighter className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
          icon={<Quote className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          active={editor.isActive("memberOnly")}
          onClick={() => {
            // 選択範囲の親ブロックを memberOnly でラップ／解除
            (editor.chain().focus() as unknown as {
              toggleMemberOnly: () => { run: () => void };
            }).toggleMemberOnly().run();
          }}
          title="メンバー限定（属性情報の入力が必要なゲート対象）"
          icon={<Lock className="h-3.5 w-3.5" />}
        />
        <Separator />
        <ToolBtn
          active={editor.isActive("link")}
          onClick={setLink}
          title="リンク"
          icon={<LinkIcon className="h-3.5 w-3.5" />}
        />
        {editor.isActive("link") && (
          <ToolBtn
            active={false}
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="リンク解除"
            icon={<Unlink className="h-3.5 w-3.5" />}
          />
        )}
      </div>
    </BubbleMenu>
  );
}

function ToolBtn({
  active,
  onClick,
  title,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()} // ブラーで選択が消えないように
      title={title}
      aria-label={title}
      className={cn(
        "rounded p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink",
        active && "bg-brand-100 text-brand-700"
      )}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-surface-border" />;
}

// =====================================================================
// 表のセル選択時に出る「セル背景色 / 文字色」バブルメニュー
// =====================================================================

const CELL_BG_PALETTE: Array<{ value: string | null; label: string }> = [
  { value: null, label: "クリア" },
  { value: "#ffffff", label: "白" },
  { value: "#f1f5f9", label: "ライトグレー" },
  { value: "#fef3c7", label: "ライトイエロー" },
  { value: "#d1fae5", label: "ライトグリーン" },
  { value: "#dbeafe", label: "ライトブルー" },
  { value: "#fce7f3", label: "ライトピンク" },
  { value: "#ede9fe", label: "ライトパープル" },
  { value: "#fee2e2", label: "ライトレッド" },
];

const CELL_TEXT_PALETTE: Array<{ value: string | null; label: string }> = [
  { value: null, label: "デフォルト" },
  { value: "#0f172a", label: "黒" },
  { value: "#475569", label: "グレー" },
  { value: "#dc2626", label: "赤" },
  { value: "#ea580c", label: "オレンジ" },
  { value: "#16a34a", label: "緑" },
  { value: "#2563eb", label: "青" },
  { value: "#7c3aed", label: "紫" },
  { value: "#ffffff", label: "白" },
];

function CellColorBubbleMenu({ editor }: { editor: Editor }) {
  // セル単位の attribute 更新は @tiptap/extension-table の組み込みコマンド
  // setCellAttribute(name, value) を使う。CellSelection なら範囲全体に適用される。
  const setBg = (value: string | null) =>
    editor.chain().focus().setCellAttribute("backgroundColor", value).run();
  const setColor = (value: string | null) =>
    editor.chain().focus().setCellAttribute("textColor", value).run();

  const cellAttrs = (editor.isActive("tableHeader")
    ? editor.getAttributes("tableHeader")
    : editor.getAttributes("tableCell")) as {
    backgroundColor?: string | null;
    textColor?: string | null;
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor }) => {
        const sel = editor.state.selection;
        if (sel instanceof CellSelection) return true;
        return false;
      }}
      options={{ placement: "top", offset: 10 }}
    >
      <div className="flex flex-col gap-1.5 rounded-lg border border-surface-border bg-white p-2 shadow-lg">
        <ColorRow
          label="背景"
          palette={CELL_BG_PALETTE}
          current={cellAttrs.backgroundColor ?? null}
          onPick={setBg}
        />
        <ColorRow
          label="文字"
          palette={CELL_TEXT_PALETTE}
          current={cellAttrs.textColor ?? null}
          onPick={setColor}
        />
      </div>
    </BubbleMenu>
  );
}

function ColorRow({
  label,
  palette,
  current,
  onPick,
}: {
  label: string;
  palette: Array<{ value: string | null; label: string }>;
  current: string | null;
  onPick: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-7 shrink-0 text-[10px] font-semibold text-ink-muted">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {palette.map((c) => {
          const active = current === c.value;
          const isClear = c.value === null;
          return (
            <button
              key={c.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(c.value)}
              title={c.label}
              aria-label={`${label}: ${c.label}`}
              className={cn(
                "relative h-5 w-5 rounded-full border transition hover:scale-110",
                active
                  ? "border-ink shadow-sm"
                  : "border-surface-border hover:border-ink/40"
              )}
              style={{
                background: c.value ?? "transparent",
              }}
            >
              {isClear && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-ink-muted">
                  ⊘
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// エディタ本文・表・引用などの note 風タイポグラフィ
// =====================================================================

/**
 * エディタ「専用」の見た目（caret / placeholder / 表セル選択ハイライト /
 * カラム幅変更ハンドル / FAQ NodeView 編集モード）。
 *
 * 共通の本文・見出し・テーブル・FAQ 表示などは ArticleBodyStyles に集約済み。
 * ここはエディタの操作 UI 由来のスタイルだけに限定する。
 */
function EditorStyles() {
  return (
    <style>{`
      .tiptap-content { caret-color: #2563eb; }

      /* テーブル選択ハイライト（CellSelection の各セル） */
      .tiptap-content .selectedCell:after {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(37, 99, 235, 0.08);
        pointer-events: none;
      }
      /* カラム幅リサイズハンドル */
      .tiptap-content .column-resize-handle {
        position: absolute;
        right: -2px;
        top: 0;
        bottom: -2px;
        width: 4px;
        background: #2563eb;
        pointer-events: none;
      }

      /* Placeholder（空ブロックに薄く表示） */
      .tiptap-content p.is-editor-empty:first-child::before,
      .tiptap-content h1.is-empty::before,
      .tiptap-content h2.is-empty::before,
      .tiptap-content h3.is-empty::before {
        content: attr(data-placeholder);
        float: left;
        color: #94a3b8;
        pointer-events: none;
        height: 0;
      }

      /* FaqItem は編集中 NodeView で <div class="faq-item-edit"> として描画。
         <details> の表示制御に頼らず常に回答が見えるように上書き。 */
      .tiptap-content .faq-item-edit { display: block; }
      .tiptap-content .faq-item-edit > * { display: block; }
    `}</style>
  );
}
