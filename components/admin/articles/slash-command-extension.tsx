"use client";

import { Extension, type Editor } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  List,
  ListOrdered,
  Lock,
  Quote,
  Code,
  Minus,
  Image as ImageIcon,
  Table as TableIcon,
  Type,
  Sparkles,
} from "lucide-react";
import {
  SlashCommandList,
  type CommandItem,
  type SlashCommandListRef,
} from "./SlashCommandList";
import { buildEmptyFaqSection } from "./faq-extension";

export type SlashRange = { from: number; to: number };

/** AI 執筆コマンドが押された時に呼ばれるコールバック */
export type OnAiWriteCallback = (editor: Editor, range: SlashRange) => void;

/**
 * "/" を打つと表示されるコマンドメニュー定義。
 * Notion / note 風のブロック挿入 UI + AI 執筆。
 *
 * onAiWrite を渡すことで /ai コマンドが活性化する。
 */
function buildCommandDefs(
  onAiWrite?: OnAiWriteCallback
): CommandItem[] {
  const items: CommandItem[] = [
    {
      title: "段落",
      description: "本文（標準テキスト）",
      searchTerms: ["paragraph", "text", "段落", "本文"],
      icon: <Type className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode("paragraph").run();
      },
    },
    {
      title: "見出し 1",
      description: "セクション大見出し",
      searchTerms: ["h1", "heading1", "見出し1", "midashi", "h"],
      icon: <Heading1 className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      title: "見出し 2",
      description: "セクション中見出し",
      searchTerms: ["h2", "heading2", "見出し2"],
      icon: <Heading2 className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      title: "見出し 3",
      description: "セクション小見出し",
      searchTerms: ["h3", "heading3", "見出し3"],
      icon: <Heading3 className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      title: "箇条書き",
      description: "・ で始まるリスト",
      searchTerms: ["bullet", "list", "ul", "リスト", "箇条書き"],
      icon: <List className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "番号付きリスト",
      description: "1. 2. 3. の順序付きリスト",
      searchTerms: ["ordered", "list", "ol", "番号", "リスト"],
      icon: <ListOrdered className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "引用",
      description: "縦線付きの引用ブロック",
      searchTerms: ["quote", "blockquote", "引用"],
      icon: <Quote className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "コードブロック",
      description: "等幅フォントのコード",
      searchTerms: ["code", "codeblock", "コード"],
      icon: <Code className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "区切り線",
      description: "水平線でセクション区切り",
      searchTerms: ["hr", "divider", "区切り", "せん"],
      icon: <Minus className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "表",
      description: "3 × 3 のテーブルを挿入",
      searchTerms: ["table", "テーブル", "ひょう", "表"],
      icon: <TableIcon className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: "画像",
      description: "URL を入れて画像を挿入",
      searchTerms: ["image", "img", "画像", "がぞう"],
      icon: <ImageIcon className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const url = window.prompt("画像 URL を入力:");
        if (!url) return;
        editor.chain().focus().setImage({ src: url }).run();
      },
    },
    {
      title: "FAQ",
      description: "Q&A の折りたたみブロック",
      searchTerms: ["faq", "Q&A", "qa", "質問", "よくある質問", "アコーディオン"],
      icon: <HelpCircle className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(buildEmptyFaqSection())
          .run();
      },
    },
    {
      title: "メンバー限定",
      description: "属性情報の入力が必要なゲートブロック（モザイク表示）",
      searchTerms: ["member", "members", "限定", "ゲート", "gate", "lock", "ロック"],
      icon: <Lock className="h-4 w-4" />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "memberOnly",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "メンバー限定のコンテンツをここに記入" },
                ],
              },
            ],
          })
          .run();
      },
    },
  ];

  // AI 執筆（onAiWrite が渡されている場合のみ追加）
  if (onAiWrite) {
    items.unshift({
      title: "AI 執筆",
      description: "AI に本文を書いてもらう（モーダルで詳細を設定）",
      searchTerms: ["ai", "AI", "執筆", "ai執筆", "ai-write", "auto", "write"],
      icon: <Sparkles className="h-4 w-4" />,
      command: ({ editor, range }) => {
        // スラッシュコマンドの "/" 等を消してから、モーダル開く
        editor.chain().focus().deleteRange(range).run();
        // 削除後の position で AI 結果を挿入できるよう、現在の selection を渡す
        const pos = editor.state.selection.from;
        onAiWrite(editor as unknown as Editor, { from: pos, to: pos });
      },
    });
  }

  return items;
}

function filterItems(
  query: string,
  onAiWrite?: OnAiWriteCallback
): CommandItem[] {
  const all = buildCommandDefs(onAiWrite);
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((it) => {
    const hay = [it.title, it.description, ...(it.searchTerms ?? [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

type SlashCommandOptions = {
  onAiWrite?: OnAiWriteCallback;
  suggestion: Record<string, unknown>;
};

/**
 * "/" でメニューを開く Tiptap 拡張
 *
 * 使い方:
 *   SlashCommand.configure({ onAiWrite: (editor, range) => setAiOpen(true) })
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slash-command",

  addOptions() {
    return {
      onAiWrite: undefined,
      suggestion: {
        char: "/",
        allowSpaces: false,
        startOfLine: true,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: any;
          range: any;
          props: CommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const onAiWrite = this.options.onAiWrite;
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterItems(query, onAiWrite),
        render: () => {
          let component: ReactRenderer<SlashCommandListRef, any> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              });
              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                offset: [0, 6],
                animation: false,
              });
            },
            onUpdate(props: any) {
              component?.updateProps(props);
              if (!props.clientRect) return;
              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
              });
            },
            onKeyDown(props: any) {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
