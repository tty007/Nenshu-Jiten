/**
 * 保存済み記事 HTML の見た目を統一するための共通スタイル。
 *
 * 使い手：
 *   - 管理プレビュー（/admin/articles/[id]/preview）
 *   - エディタ（TipTap：内部で `.tiptap-content` クラスを持つ contenteditable）
 *   - 将来の公開ページ（/companies/{edinet}/salary 等）
 *
 * セレクタは `.article-body` と `.tiptap-content` の双方を一度に対象にし、
 * エディタ・プレビュー・公開で配色が絶対にズレないことを保証する。
 *
 * エディタ専用の挙動（caret-color、placeholder、selectedCell、column-resize-handle、
 * faq-item-edit など）は TipTapEditor の `EditorStyles` 側に残す。
 */
export function ArticleBodyStyles() {
  return <style>{ARTICLE_BODY_CSS}</style>;
}

const ARTICLE_BODY_CSS = `
/* 目次アンカークリック時の滑らかスクロール */
html { scroll-behavior: smooth; }

/* ===== メンバー限定マーカー ===== */
.tiptap-content .member-only,
.article-body .member-only {
  position: relative;
  padding: 0.85rem 1rem 1rem;
  margin: 1.5rem 0;
  background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
  border-radius: 4px;
}
/* 見出しはバッジ付きで表示（モザイク対象外） */
.tiptap-content .member-only > :is(h1, h2, h3),
.article-body .member-only > :is(h1, h2, h3) {
  position: relative;
  margin-top: 0.2em;
}
.tiptap-content .member-only > :is(h1, h2, h3):first-child::after,
.article-body .member-only > :is(h1, h2, h3):first-child::after {
  content: "メンバー限定";
  display: inline-block;
  margin-left: 0.7em;
  padding: 0.18em 0.6em;
  vertical-align: middle;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ffffff;
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
  border-radius: 3px;
  -webkit-background-clip: padding-box;
  background-clip: padding-box;
}
/* 公開ページでは見出し以外をモザイク（デフォルトロック） */
.article-body .member-only > :not(:is(h1, h2, h3)):not(.member-overlay) {
  filter: blur(6px) saturate(0.85);
  user-select: none;
  pointer-events: none;
  transition: filter 0.3s ease;
}
.article-body .member-only.is-unlocked > :not(:is(h1, h2, h3)):not(.member-overlay) {
  filter: none;
  user-select: auto;
  pointer-events: auto;
}
.article-body .member-only.is-unlocked > :is(h1, h2, h3):first-child::after {
  display: none;
}
/* CTA オーバーレイ（JS が locked 時のみ挿入） */
.article-body .member-only .member-overlay {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  justify-content: center;
  pointer-events: none;
  padding: 0 1rem;
  z-index: 5;
}
.article-body .member-only.is-unlocked .member-overlay { display: none; }
.article-body .member-only .member-overlay__card {
  pointer-events: auto;
  max-width: 380px;
  width: 100%;
  padding: 1.2rem 1.4rem;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  text-align: center;
}
.article-body .member-only .member-overlay__title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 0.4em;
}
.article-body .member-only .member-overlay__desc {
  font-size: 0.82rem;
  line-height: 1.7;
  color: #475569;
  margin: 0 0 0.85em;
}
.article-body .member-only .member-overlay__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1.1rem;
  font-size: 0.84rem;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
  border-radius: 6px;
  text-decoration: none;
}
.article-body .member-only .member-overlay__btn:hover { opacity: 0.92; }

/* エディタ専用：編集中はモザイクをかけず、ブロック全体に明示的な枠＋ラベルを出す */
.tiptap-content .member-only,
.tiptap-content .member-only-edit {
  position: relative;
  padding: 1.6rem 1rem 1rem;
  margin: 1.8rem 0 1.5rem;
  border: 2px dashed #93c5fd;
  background:
    linear-gradient(135deg, rgba(219, 234, 254, 0.55) 0%, rgba(199, 210, 254, 0.45) 100%),
    repeating-linear-gradient(-45deg, transparent 0, transparent 6px, rgba(37, 99, 235, 0.05) 6px, rgba(37, 99, 235, 0.05) 7px);
  border-radius: 6px;
  transition: border-color 0.15s, background 0.15s;
}
.tiptap-content .member-only:hover,
.tiptap-content .member-only-edit:hover {
  border-color: #60a5fa;
}
/* 上部のラベル：常時表示（中身に見出しが無くても表れる） */
.tiptap-content .member-only::before,
.tiptap-content .member-only-edit::before {
  content: "🔒 メンバー限定セクション（属性情報の入力が必要）";
  position: absolute;
  top: -0.85em;
  left: 0.9rem;
  padding: 0.22em 0.7em;
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
  pointer-events: none;
  user-select: none;
}
/* 公開ページ側で出している ::after の「メンバー限定」バッジは
   エディタでは不要（::before の常時ラベルで識別済み）なので隠す */
.tiptap-content .member-only > :is(h1, h2, h3):first-child::after,
.tiptap-content .member-only-edit > :is(h1, h2, h3):first-child::after {
  display: none;
}

/* ===== ブロック間隔 ===== */
.tiptap-content > * + *,
.article-body > * + * { margin-top: 1.2em; }

/* ===== 本文（ゆとりのある行間） ===== */
.tiptap-content p,
.article-body p {
  font-size: 1.0625rem;
  line-height: 2.1;
  color: #1f2937;
}
.tiptap-content li,
.article-body li { line-height: 2.0; }
.tiptap-content li + li,
.article-body li + li { margin-top: 0.45em; }
.tiptap-content li > p,
.article-body li > p { margin: 0.25em 0; }

/* ===== H1：青グラデ文字＋下にヘアライン罫（左の装飾なし） ===== */
.tiptap-content h1,
.article-body h1 {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.4;
  margin-top: 2.4em;
  margin-bottom: 0.75em;
  padding-bottom: 0.5em;
  letter-spacing: -0.01em;
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  border-bottom: 1px solid #e5e7eb;
}

/* ===== H2：青グラデ文字 ＋ 下にヘアライン罫だけのシンプル仕上げ ===== */
.tiptap-content h2,
.article-body h2 {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.4;
  margin-top: 2.2em;
  margin-bottom: 0.7em;
  padding-bottom: 0.4em;
  letter-spacing: -0.008em;
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  border-bottom: 1px solid #e5e7eb;
}

/* ===== H3：青グラデ文字 ＋ 左に青グラデのチェックマーク ===== */
.tiptap-content h3,
.article-body h3 {
  position: relative;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.5;
  margin-top: 1.5em;
  margin-bottom: 0.4em;
  padding-left: 1.55em;
  letter-spacing: -0.002em;
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 55%, #60a5fa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.tiptap-content h3::before,
.article-body h3::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: 0;
  font-weight: 900;
  font-size: 1.15em;
  line-height: 1.5;
  background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 55%, #38bdf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.tiptap-content h1 + p,
.tiptap-content h2 + p,
.tiptap-content h3 + p,
.article-body h1 + p,
.article-body h2 + p,
.article-body h3 + p { margin-top: 0.5em; }

/* ===== リスト ===== */
.tiptap-content ul,
.article-body ul { list-style: disc; padding-left: 1.5rem; }
.tiptap-content ol,
.article-body ol { list-style: decimal; padding-left: 1.5rem; }

/* ===== 引用 ===== */
.tiptap-content blockquote,
.article-body blockquote {
  border-left: 3px solid #cbd5e1;
  padding-left: 1rem;
  color: #475569;
  font-style: normal;
  line-height: 2.0;
}

/* ===== コード ===== */
.tiptap-content code,
.article-body code {
  background: #f1f5f9;
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-size: 0.92em;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.tiptap-content pre,
.article-body pre {
  background: #0f172a;
  color: #f8fafc;
  padding: 1rem 1.1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.92em;
  line-height: 1.6;
}
.tiptap-content pre code,
.article-body pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

/* ===== HR / リンク / 画像 ===== */
.tiptap-content hr,
.article-body hr {
  margin: 2rem 0;
  border: 0;
  border-top: 1px solid #e5e7eb;
}
.tiptap-content a,
.article-body a {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.tiptap-content img,
.article-body img {
  max-width: 100%;
  height: auto;
  margin: 1rem 0;
  border-radius: 8px;
}

/* ===== 蛍光ペン ===== */
.tiptap-content mark,
.tiptap-content mark.tiptap-mark,
.article-body mark,
.article-body mark.tiptap-mark {
  background: #fde047;
  color: inherit;
  padding: 0.05em 0.15em;
  border-radius: 2px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

/* ===== テーブル：横幅 100% を基本に、はみ出したら横スクロール ===== */
.tiptap-content table,
.article-body table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1rem 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.tiptap-content table::-webkit-scrollbar,
.article-body table::-webkit-scrollbar { display: none; width: 0; height: 0; }
.tiptap-content table > thead,
.tiptap-content table > tbody,
.tiptap-content table > tfoot,
.article-body table > thead,
.article-body table > tbody,
.article-body table > tfoot {
  display: table;
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}
.tiptap-content table > * > tr,
.article-body table > * > tr { display: table-row; }
.tiptap-content table th,
.tiptap-content table td,
.article-body table th,
.article-body table td {
  border: 1px solid #e5e7eb;
  padding: 0.6rem 0.7rem;
  vertical-align: top;
  position: relative;
  white-space: nowrap;
}
.tiptap-content table th,
.article-body table th {
  background: #f8fafc;
  font-weight: 600;
  text-align: left;
}

/* テンプレ生成テーブル：行ごとの意味付け色 */
.tiptap-content table tr.row-subtotal > td,
.article-body table tr.row-subtotal > td {
  background: #dbeafe;
  color: #1e3a8a;
}
.tiptap-content table tr.row-estimate > td,
.article-body table tr.row-estimate > td {
  background: #fee2e2;
  color: #991b1b;
}
.tiptap-content table tr.row-grand-total > td,
.article-body table tr.row-grand-total > td {
  background: #dbeafe;
  color: #1e3a8a;
  font-weight: 700;
}

/* テーブル横スクロールヒント（JS で data-scrollable トグル） */
.tiptap-content table[data-scrollable],
.article-body table[data-scrollable] { margin-bottom: 0.4rem; }
.table-scroll-hint {
  display: none;
  margin: 0.35rem 0 1rem;
  text-align: right;
  font-size: 0.78rem;
  color: #94a3b8;
  user-select: none;
}
.table-scroll-hint[data-scrollable] {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.4rem;
}
.table-scroll-hint__arrow {
  display: inline-block;
  animation: tableScrollHintArrow 1.4s ease-in-out infinite;
}
@keyframes tableScrollHintArrow {
  0%, 100% { transform: translateX(0); opacity: 0.6; }
  55%      { transform: translateX(6px); opacity: 1; }
}

/* ===== FAQ：上下罫線で区切るスタイリッシュなフラットデザイン ===== */
.tiptap-content .faq-section,
.article-body .faq-section {
  margin: 1.75rem 0;
  border-top: 2px solid #0f172a;
}
.tiptap-content .faq-item,
.article-body details.faq-item {
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  background: transparent;
  padding: 1.1rem 0 1.25rem;
  box-shadow: none;
}
.tiptap-content .faq-item:last-child,
.article-body details.faq-item:last-child { border-bottom: 0; }
.tiptap-content .faq-item > summary,
.article-body details.faq-item > summary {
  cursor: pointer;
  font-weight: 700;
  color: #0f172a;
  list-style: none;
  position: relative;
  padding-left: 2.4rem;
  padding-right: 1.75rem;
  font-size: 1.02rem;
  line-height: 1.6;
  letter-spacing: -0.005em;
}
.tiptap-content .faq-item > summary::-webkit-details-marker,
.article-body details.faq-item > summary::-webkit-details-marker { display: none; }
.tiptap-content .faq-item > summary::before,
.article-body details.faq-item > summary::before {
  content: "Q";
  position: absolute;
  left: 0;
  top: -0.05em;
  font-family: ui-serif, Georgia, "Times New Roman", serif;
  font-weight: 800;
  font-size: 1.2rem;
  color: #2563eb;
  width: 1.7rem;
  text-align: center;
}
/* 折り畳み chevron は <details> 用のみ */
.tiptap-content details.faq-item > summary::after,
.article-body details.faq-item > summary::after {
  content: "";
  position: absolute;
  right: 0.15rem;
  top: 0.55em;
  width: 0.6rem;
  height: 0.6rem;
  border-right: 1.5px solid #94a3b8;
  border-bottom: 1.5px solid #94a3b8;
  transform: rotate(45deg);
  transition: transform 0.2s;
}
.tiptap-content details.faq-item[open] > summary::after,
.article-body details.faq-item[open] > summary::after {
  transform: rotate(-135deg);
  top: 0.75em;
}
.tiptap-content .faq-item > summary:hover::before,
.article-body details.faq-item > summary:hover::before { color: #1d4ed8; }
.tiptap-content .faq-item > *:not(summary),
.article-body details.faq-item > *:not(summary) {
  margin: 0.6rem 0 0 2.4rem;
  color: #334155;
  line-height: 1.85;
  position: relative;
}
.tiptap-content .faq-item > *:not(summary):first-of-type::before,
.article-body details.faq-item > *:not(summary):first-of-type::before {
  content: "A";
  position: absolute;
  left: -2.4rem;
  top: -0.1em;
  font-family: ui-serif, Georgia, "Times New Roman", serif;
  font-weight: 800;
  font-size: 1.2rem;
  color: #94a3b8;
  width: 1.7rem;
  text-align: center;
}
`;
