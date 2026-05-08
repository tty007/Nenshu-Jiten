// FAQ アコーディオン用の TipTap 拡張
//
// 構成:
//   FaqSection (block container, group: block)  → <div class="faq-section">
//     FaqItem (block, group: block)              → <details class="faq-item">
//       FaqSummary (defining)                    → <summary>
//       block+ (paragraph 等)                    → 回答本文
//
// 出力 HTML はネイティブの <details>/<summary> なので、公開ページでも
// JS なしでアコーディオンとして動作する。

import { Node, mergeAttributes } from "@tiptap/core";

export const FaqSummary = Node.create({
  name: "faqSummary",
  content: "inline*",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "summary",
      mergeAttributes(HTMLAttributes, { class: "faq-summary" }),
      0,
    ];
  },
});

export const FaqItem = Node.create({
  name: "faqItem",
  group: "block",
  // summary 必須 + 1 ブロック以上の回答
  content: "faqSummary block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (el) => (el as HTMLDetailsElement).hasAttribute("open"),
        renderHTML: (attrs) => (attrs.open ? { open: "" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, { class: "faq-item" }),
      0,
    ];
  },

  // 編集中は <details> ではなく <div> として描画する。
  // <details> は閉じている間ブラウザが回答を非表示にするため、
  // エディタ上では常に回答を編集できるよう、見た目だけ div に置き換える。
  // 保存・公開時は renderHTML 側の <details> が使われるので閲覧時挙動は変わらない。
  addNodeView() {
    return ({ HTMLAttributes }) => {
      const dom = document.createElement("div");
      dom.className = "faq-item faq-item-edit";
      Object.entries(HTMLAttributes).forEach(([k, v]) => {
        if (k === "class") return; // 上で固定済み
        if (typeof v === "string") dom.setAttribute(k, v);
      });
      return { dom, contentDOM: dom };
    };
  },
});

export const FaqSection = Node.create({
  name: "faqSection",
  group: "block",
  content: "faqItem+",

  parseHTML() {
    return [{ tag: 'div[data-type="faq-section"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "faq-section",
        class: "faq-section",
      }),
      0,
    ];
  },

  /**
   * 空段落と FaqSection が隣接している時の削除でスキーマ違反
   * ("Content does not fit in gap") が起きるのを回避する。
   *
   *  - Backspace: 空段落の中で押された && 直前が faqSection → 空段落を消す
   *  - Delete   : 空段落の中で押された && 直後が faqSection → 空段落を消す
   *
   * 通常の join/merge を全否定はせず、上記ピンポイントのケースのみ
   * 段落自体の delete に置換する。
   */
  addKeyboardShortcuts() {
    const isEmptyParagraphAt = (node: any) =>
      node && node.type.name === "paragraph" && node.content.size === 0;

    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if (!isEmptyParagraphAt($from.parent)) return false;
        const before = $from.before();
        if (before <= 0) return false;
        const prev = state.doc.resolve(before).nodeBefore;
        if (!prev || prev.type.name !== "faqSection") return false;
        editor
          .chain()
          .deleteRange({ from: before, to: $from.after() })
          .run();
        return true;
      },
      Delete: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if (!isEmptyParagraphAt($from.parent)) return false;
        const after = $from.after();
        if (after >= state.doc.content.size) return false;
        const next = state.doc.resolve(after).nodeAfter;
        if (!next || next.type.name !== "faqSection") return false;
        editor
          .chain()
          .deleteRange({ from: $from.before(), to: after })
          .run();
        return true;
      },
    };
  },
});

/** ProseMirror Node JSON テンプレート（slash command 等から挿入用） */
export function buildEmptyFaqSection() {
  return {
    type: "faqSection",
    content: [
      {
        type: "faqItem",
        content: [
          {
            type: "faqSummary",
            content: [{ type: "text", text: "質問を入力" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "回答を入力" }],
          },
        ],
      },
    ],
  };
}
