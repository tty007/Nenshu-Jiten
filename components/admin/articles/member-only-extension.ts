// メンバー限定ブロック用の TipTap 拡張
//
// 構成: <div data-member-only="true" class="member-only">block+</div>
// レンダリング: 編集中はそのまま div として描画（モザイク無し、薄い青枠で識別）
// 公開ページでは ArticleBodyStyles の CSS が中身をモザイク化する。

import { Node, mergeAttributes } from "@tiptap/core";

export const MemberOnly = Node.create({
  name: "memberOnly",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-member-only]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-member-only": "true",
        class: "member-only",
      }),
      0,
    ];
  },

  // エディタ用の編集モード描画。バッジ付きの div として表示。
  addNodeView() {
    return ({ HTMLAttributes }) => {
      const dom = document.createElement("div");
      dom.className = "member-only member-only-edit";
      dom.setAttribute("data-member-only", "true");
      Object.entries(HTMLAttributes).forEach(([k, v]) => {
        if (k === "class" || k === "data-member-only") return;
        if (typeof v === "string") dom.setAttribute(k, v);
      });
      return { dom, contentDOM: dom };
    };
  },

  addCommands() {
    return {
      // 現在のブロック範囲を memberOnly でラップ
      wrapInMemberOnly:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      // メンバー限定ラップを解除
      unwrapMemberOnly:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
      // トグル：現在 memberOnly の中なら解除、外なら包む
      toggleMemberOnly:
        () =>
        ({ commands, editor }) => {
          if (editor.isActive(this.name)) {
            return commands.lift(this.name);
          }
          return commands.wrapIn(this.name);
        },
    } as any;
  },
});
