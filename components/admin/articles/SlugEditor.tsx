"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setArticleSlug } from "@/lib/admin/articles/actions";
import { toast } from "@/lib/toast";

type Props = {
  articleId: string;
  initialSlug: string | null;
  /**
   * カテゴリ + 企業から計算される「自動部分」。
   * UI 上は固定で表示し、ユーザは末尾の追加セグメントだけ編集可能。
   * 例: "salary/E39903"（カテゴリ + 企業）／ "salary"（カテゴリのみ）／ "E39903-E12345"（企業のみ）
   */
  autoPrefix: string | null;
  /** 親コンポーネントの URL リンクと同期するためのコールバック */
  onSlugChange?: (next: string | null) => void;
};

/** slug を autoPrefix と suffix に分解 */
function splitSlug(slug: string | null, autoPrefix: string | null): {
  matchesPrefix: boolean;
  suffix: string;
} {
  if (!slug) return { matchesPrefix: true, suffix: "" };
  if (!autoPrefix) return { matchesPrefix: false, suffix: slug };
  if (slug === autoPrefix) return { matchesPrefix: true, suffix: "" };
  if (slug.startsWith(`${autoPrefix}/`)) {
    return { matchesPrefix: true, suffix: slug.slice(autoPrefix.length + 1) };
  }
  // prefix と一致しない（旧フォーマット等）→ 空欄スタートに
  return { matchesPrefix: false, suffix: "" };
}

function composeSlug(autoPrefix: string | null, suffix: string): string | null {
  const s = suffix.trim().replace(/^\/+|\/+$/g, "");
  if (autoPrefix && s) return `${autoPrefix}/${s}`;
  if (autoPrefix) return autoPrefix;
  if (s) return s;
  return null;
}

export function SlugEditor({
  articleId,
  initialSlug,
  autoPrefix,
  onSlugChange,
}: Props) {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const initialSplit = useMemo(
    () => splitSlug(initialSlug, autoPrefix),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [suffix, setSuffix] = useState<string>(initialSplit.suffix);
  const [pending, startTransition] = useTransition();
  const lastAutoPrefixRef = useRef<string | null | undefined>(undefined);
  const isMountedRef = useRef(false);

  // autoPrefix が変わるたびに、現在の suffix と組み合わせ直して保存
  useEffect(() => {
    // 初回マウントは「初期 slug を再保存し直す」のではなく、
    // 既存と異なる場合だけ同期。
    if (lastAutoPrefixRef.current === autoPrefix) return;
    lastAutoPrefixRef.current = autoPrefix;
    const next = composeSlug(autoPrefix, suffix);
    if (next === slug) return;
    if (!isMountedRef.current) {
      // 初回：初期 slug が DB と既に一致なら何もしない
      if (next === initialSlug) {
        isMountedRef.current = true;
        return;
      }
    }
    isMountedRef.current = true;
    startTransition(async () => {
      const res = await setArticleSlug(articleId, next);
      if (!res.ok) {
        toast.error(`スラッグ自動更新失敗: ${res.error}`);
        return;
      }
      setSlug(res.data.slug);
      onSlugChange?.(res.data.slug);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrefix]);

  const apply = () => {
    const next = composeSlug(autoPrefix, suffix);
    if (next === slug) return;
    startTransition(async () => {
      const res = await setArticleSlug(articleId, next);
      if (!res.ok) return toast.error(res.error);
      setSlug(res.data.slug);
      onSlugChange?.(res.data.slug);
      toast.success(
        res.data.slug ? `スラッグを「${res.data.slug}」に設定しました` : "スラッグを解除しました"
      );
    });
  };

  const fixedPrefix = autoPrefix ? `/articles/${autoPrefix}/` : "/articles/";

  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 text-sm">
      <span
        className="select-all shrink-0 whitespace-nowrap rounded-md bg-surface-muted px-2 py-1.5 font-mono text-xs text-ink-muted"
        title="自動生成（カテゴリ + 企業コードから）"
      >
        {fixedPrefix}
      </span>
      <input
        type="text"
        value={suffix}
        onChange={(e) => setSuffix(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
        placeholder={autoPrefix ? "末尾セグメント（任意）" : "スラッグ全体（任意）"}
        disabled={pending}
        className="min-w-0 flex-1 rounded-md border border-surface-border bg-white px-2.5 py-1.5 font-mono text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={apply}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-positive/30 bg-positive-50 px-3 py-1.5 text-xs font-semibold text-positive-800 hover:bg-positive-100 disabled:opacity-40"
      >
        <Check className="h-3.5 w-3.5" />
        保存
      </button>
    </div>
  );
}
