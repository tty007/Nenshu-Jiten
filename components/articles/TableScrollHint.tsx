"use client";

import { useEffect } from "react";

/**
 * 指定セレクタの中にある <table> を走査し、
 *  1) 各 <table> を <div class="table-scroll"> でラップ（未ラップ時のみ）
 *  2) ラッパの scrollWidth > clientWidth なら data-scrollable を付与
 *  3) ラッパ直後に「スクロールできます →」のヒント要素を 1 度だけ挿入し、
 *     スクロール可否に応じて表示/非表示を切り替える
 *
 * ResizeObserver + MutationObserver で、リサイズや TipTap の編集に追従。
 *
 * 注意：ProseMirror が管理する DOM をいじるのは編集系で副作用があり得るため、
 * エディタ内（TipTap）では Table 拡張側 NodeView でラッパを発行している。
 * このコンポーネントは「ラッパが既にある場合」「無ければ新規作成」両対応。
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

    const ensureWrapper = (table: HTMLTableElement): HTMLElement => {
      const parent = table.parentElement;
      if (parent && parent.classList.contains("table-scroll")) return parent;
      const wrapper = document.createElement("div");
      wrapper.className = "table-scroll";
      table.insertAdjacentElement("beforebegin", wrapper);
      wrapper.appendChild(table);
      return wrapper;
    };

    const ensureHint = (wrapper: HTMLElement): HTMLElement => {
      const next = wrapper.nextElementSibling as HTMLElement | null;
      if (next && next.classList.contains("table-scroll-hint")) return next;
      const hint = document.createElement("div");
      hint.className = "table-scroll-hint";
      hint.setAttribute("aria-hidden", "true");
      hint.innerHTML = `<span>${hintText}</span><span class="table-scroll-hint__arrow">→</span>`;
      wrapper.insertAdjacentElement("afterend", hint);
      return hint;
    };

    const evaluate = (wrapper: HTMLElement) => {
      const isScrollable = wrapper.scrollWidth > wrapper.clientWidth + 1;
      if (isScrollable) wrapper.setAttribute("data-scrollable", "");
      else wrapper.removeAttribute("data-scrollable");
      const hint = ensureHint(wrapper);
      if (isScrollable) hint.setAttribute("data-scrollable", "");
      else hint.removeAttribute("data-scrollable");
    };

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) evaluate(e.target as HTMLElement);
    });

    const scan = () => {
      for (const c of containers) {
        c.querySelectorAll<HTMLTableElement>("table").forEach((tbl) => {
          const wrapper = ensureWrapper(tbl);
          if (!known.has(wrapper)) {
            known.add(wrapper);
            ensureHint(wrapper);
          }
          if (!observed.has(wrapper)) {
            observed.add(wrapper);
            ro.observe(wrapper);
          }
          evaluate(wrapper);
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
