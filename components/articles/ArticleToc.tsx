"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TocItem } from "@/lib/article-toc";

type Props = {
  items: TocItem[];
};

export function ArticleToc({ items }: Props) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  // h2 だけを採番対象にし、h3 は番号無し（親 h2 配下の細目扱い）
  let mainCounter = 0;
  const numbered = items.map((it) => {
    if (it.level === 2) {
      mainCounter += 1;
      return { ...it, number: mainCounter };
    }
    return { ...it, number: null as number | null };
  });

  return (
    <nav aria-label="目次" className="article-toc">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`article-toc__toggle${open ? " is-open" : ""}`}
      >
        <span className="article-toc__toggle-left">
          <span className="article-toc__title">目次</span>
          <span className="article-toc__title-en">Contents</span>
          <span className="article-toc__count">{items.length}</span>
        </span>
        <span className="article-toc__toggle-right">
          <span className="article-toc__action">{open ? "閉じる" : "開く"}</span>
          <ChevronDown
            className={`article-toc__chevron${open ? " is-open" : ""}`}
          />
        </span>
      </button>

      <div className={`article-toc__panel${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="article-toc__panel-inner">
          <ol className="article-toc__list">
            {numbered.map((item) => (
              <li
                key={item.id}
                className={
                  item.level === 3
                    ? "article-toc__item article-toc__item--sub"
                    : "article-toc__item"
                }
              >
                {item.number != null && (
                  <span className="article-toc__num">
                    {String(item.number).padStart(2, "0")}
                  </span>
                )}
                <a href={`#${item.id}`} className="article-toc__link">
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <ArticleTocStyles />
    </nav>
  );
}

function ArticleTocStyles() {
  return (
    <style>{`
      /* ===== 全体：上下の細罫だけ。背景・角丸なし ===== */
      .article-toc {
        margin: 1.75rem 0 2rem;
        border-top: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
        background: transparent;
      }

      /* ===== トグル（開閉ボタン） ===== */
      .article-toc__toggle {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1rem;
        /* 閉じている時：水色グラデの背景 */
        background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 55%, #c7d2fe 100%);
        transition: background 0.25s ease, padding 0.2s ease;
      }
      .article-toc__toggle:hover {
        background: linear-gradient(135deg, #bae6fd 0%, #bfdbfe 55%, #a5b4fc 100%);
      }
      .article-toc__toggle:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }
      /* 開いている時：透明背景に戻す */
      .article-toc__toggle.is-open {
        background: transparent;
        padding: 1rem 0.25rem;
      }
      .article-toc__toggle.is-open:hover {
        background: rgba(15, 23, 42, 0.02);
      }
      .article-toc__toggle-left {
        display: inline-flex;
        align-items: baseline;
        gap: 0.65rem;
      }
      .article-toc__title {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .article-toc__title-en {
        font-family: ui-serif, Georgia, "Times New Roman", serif;
        font-style: italic;
        font-weight: 600;
        font-size: 0.9rem;
        color: #94a3b8;
        letter-spacing: 0.03em;
      }
      .article-toc__count {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.7rem;
        font-weight: 700;
        color: #64748b;
        background: #eef2ff;
        border-radius: 9999px;
        padding: 0.15rem 0.55rem;
      }
      .article-toc__toggle-right {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .article-toc__action {
        font-size: 0.72rem;
        font-weight: 600;
        color: #94a3b8;
        letter-spacing: 0.08em;
      }
      .article-toc__chevron {
        width: 1rem;
        height: 1rem;
        color: #64748b;
        transition: transform 0.25s ease;
      }
      .article-toc__chevron.is-open { transform: rotate(180deg); }

      /* ===== 開閉アニメーション（grid-template-rows トリック） ===== */
      .article-toc__panel {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        transition:
          grid-template-rows 0.32s ease-out,
          opacity 0.25s ease-out;
      }
      .article-toc__panel.is-open {
        grid-template-rows: 1fr;
        opacity: 1;
      }
      .article-toc__panel-inner {
        overflow: hidden;
      }

      /* ===== リスト ===== */
      .article-toc__list {
        list-style: none;
        margin: 0;
        padding: 0.4rem 0 1.1rem;
      }
      .article-toc__item,
      .article-toc__item--sub {
        position: relative;
        display: flex;
        align-items: baseline;
        gap: 0.85rem;
        padding: 0.55rem 0.25rem;
        line-height: 2.0;
        border-bottom: 1px dashed transparent;
        transition: border-color 0.15s, background-color 0.15s;
      }
      .article-toc__item:hover,
      .article-toc__item--sub:hover {
        background: rgba(37, 99, 235, 0.04);
      }
      .article-toc__num {
        flex-shrink: 0;
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.78rem;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 0.04em;
        min-width: 1.6em;
        line-height: 1.6;
      }
      .article-toc__item--sub {
        padding-left: 2.7rem;
      }
      .article-toc__item--sub::before {
        content: "";
        position: absolute;
        left: 1.85rem;
        top: 1.15em;
        width: 0.6rem;
        height: 1px;
        background: #cbd5e1;
      }
      .article-toc__link {
        font-size: 0.95rem;
        color: #1e293b;
        text-decoration: none;
        line-height: 1.85;
        transition: color 0.12s;
      }
      .article-toc__item--sub .article-toc__link {
        font-size: 0.88rem;
        color: #475569;
      }
      .article-toc__link:hover {
        color: #1d4ed8;
        text-decoration: underline;
        text-underline-offset: 4px;
        text-decoration-thickness: 1px;
      }

      /* 見出しのスクロールマージン：固定ヘッダーがあっても見出しが隠れない */
      .article-body h2[id],
      .article-body h3[id] {
        scroll-margin-top: 5rem;
      }
    `}</style>
  );
}
