"use client";

import { useEffect } from "react";

/**
 * 指定セレクタの中にある <table> 要素を走査し、
 * - 内容が表示幅を超えている時だけ data-scrollable 属性を付ける
 * - 直後に「スクロールできます →」のヒント要素（.table-scroll-hint）を一度だけ挿入し、
 *   テーブルの状態に追従して表示/非表示を切り替える
 *
 * ResizeObserver + MutationObserver で、リサイズや TipTap の編集に追従。
 * スタイルは TipTapEditor.tsx / preview/page.tsx 側の CSS で定義。
 */
export function TableScrollHint({
  selector,
  hintText = "スクロールできます",
}: {
  selector: string;
  hintText?: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const containers = Array.from(
      document.querySelectorAll<HTMLElement>(selector)
    );
    if (containers.length === 0) return;

    const known = new WeakSet<HTMLElement>();
    const observed = new Set<HTMLElement>();

    const ensureHint = (table: HTMLElement): HTMLElement | null => {
      const next = table.nextElementSibling as HTMLElement | null;
      if (next && next.classList.contains("table-scroll-hint")) return next;
      const hint = document.createElement("div");
      hint.className = "table-scroll-hint";
      hint.setAttribute("aria-hidden", "true");
      hint.innerHTML = `<span>${hintText}</span><span class="table-scroll-hint__arrow">→</span>`;
      table.insertAdjacentElement("afterend", hint);
      return hint;
    };

    const evaluate = (table: HTMLElement) => {
      const isScrollable = table.scrollWidth > table.clientWidth + 1;
      if (isScrollable) {
        table.setAttribute("data-scrollable", "");
      } else {
        table.removeAttribute("data-scrollable");
      }
      const hint = ensureHint(table);
      if (!hint) return;
      if (isScrollable) {
        hint.setAttribute("data-scrollable", "");
      } else {
        hint.removeAttribute("data-scrollable");
      }
    };

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) evaluate(e.target as HTMLElement);
    });

    const scan = () => {
      for (const c of containers) {
        c.querySelectorAll<HTMLElement>("table").forEach((tbl) => {
          if (!known.has(tbl)) {
            known.add(tbl);
            ensureHint(tbl);
          }
          if (!observed.has(tbl)) {
            observed.add(tbl);
            ro.observe(tbl);
          }
          evaluate(tbl);
        });
      }
    };

    scan();
    // フォント読み込み・遅延レイアウトに備えて 2 段階で再評価
    const t1 = window.setTimeout(scan, 80);
    const t2 = window.setTimeout(scan, 400);

    const mo = new MutationObserver(() => {
      scan();
    });
    for (const c of containers) {
      mo.observe(c, { childList: true, subtree: true });
    }

    const onResize = () => observed.forEach(evaluate);
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [selector, hintText]);

  return null;
}
