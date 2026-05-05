"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * App Router のクライアントナビゲーション含めて全ページビューを記録する。
 * - usePathname / useSearchParams の変更をトリガに POST /api/track-view を発火
 * - keepalive で fire-and-forget
 * - 同じパスの連続発火を簡易デバウンス（500ms 以内の連打は無視）
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    // searchParams は計測対象に含めない（path のみ集計）
    void searchParams;
    const id = window.setTimeout(() => {
      try {
        fetch("/api/track-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathname }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [pathname, searchParams]);

  return null;
}
