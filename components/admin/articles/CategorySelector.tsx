"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, FolderTree } from "lucide-react";
import {
  setArticleCategory,
  listCategoriesForSelectorClient,
} from "@/lib/admin/articles/category-actions";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type CategoryOption = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  slug_path: string;
  name_path: string;
  depth: number;
};

type Props = {
  articleId: string;
  initialCategoryId: string | null;
  initialCategoryNamePath: string | null;
  initialCategorySlugPath: string | null;
  /** カテゴリ選択変更時のコールバック（slug 自動生成用） */
  onCategoryChange?: (cat: {
    id: string | null;
    slug_path: string | null;
    name_path: string | null;
  }) => void;
  /**
   * 外部からカテゴリを強制セットしたい場合（テンプレ一括反映時など）。
   * id が変わると内部表示状態だけを更新する（保存は呼び出し側の責務）。
   */
  externalCategory?: {
    id: string;
    slug_path: string;
    name_path: string;
  } | null;
};

export function CategorySelector({
  articleId,
  initialCategoryId,
  initialCategoryNamePath,
  initialCategorySlugPath,
  onCategoryChange,
  externalCategory,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CategoryOption[] | null>(null);
  const [catId, setCatId] = useState<string | null>(initialCategoryId);
  const [namePath, setNamePath] = useState<string | null>(
    initialCategoryNamePath
  );
  const [slugPath, setSlugPath] = useState<string | null>(
    initialCategorySlugPath
  );
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const lastExternalIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 外部からのカテゴリ強制セットに追従（テンプレ一括反映時など）。
  // 親側で setArticleCategory は既に呼ばれている前提で、UI 表示のみ更新。
  useEffect(() => {
    if (!externalCategory) return;
    if (externalCategory.id === lastExternalIdRef.current) return;
    if (externalCategory.id === catId) return;
    lastExternalIdRef.current = externalCategory.id;
    setCatId(externalCategory.id);
    setNamePath(externalCategory.name_path);
    setSlugPath(externalCategory.slug_path);
    onCategoryChange?.({
      id: externalCategory.id,
      slug_path: externalCategory.slug_path,
      name_path: externalCategory.name_path,
    });
  }, [externalCategory, catId, onCategoryChange]);

  const ensureLoaded = async () => {
    if (options) return;
    setLoading(true);
    try {
      const list = await listCategoriesForSelectorClient();
      setOptions(list);
    } catch (e) {
      toast.error(`カテゴリ読み込み失敗: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const select = (next: CategoryOption | null) => {
    const prevId = catId;
    const prevName = namePath;
    const prevSlug = slugPath;
    setCatId(next?.id ?? null);
    setNamePath(next?.name_path ?? null);
    setSlugPath(next?.slug_path ?? null);
    setOpen(false);
    onCategoryChange?.({
      id: next?.id ?? null,
      slug_path: next?.slug_path ?? null,
      name_path: next?.name_path ?? null,
    });
    startTransition(async () => {
      const res = await setArticleCategory(articleId, next?.id ?? null);
      if (!res.ok) {
        // ロールバック
        setCatId(prevId);
        setNamePath(prevName);
        setSlugPath(prevSlug);
        toast.error(`保存に失敗: ${res.error}`);
        return;
      }
      toast.success(
        next ? `カテゴリを「${next.name_path}」に設定しました` : "カテゴリを未設定に戻しました"
      );
    });
  };

  return (
    <div ref={ref} className="relative inline-block text-sm">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          ensureLoaded();
        }}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm transition hover:bg-surface-muted/50 disabled:opacity-60",
          catId
            ? "border-surface-border text-ink"
            : "border-dashed border-ink/40 text-ink-muted"
        )}
      >
        <FolderTree className="h-4 w-4 text-ink-muted" />
        {catId && namePath ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-medium text-ink">{namePath}</span>
            {slugPath && (
              <span className="font-mono text-[10px] text-ink-subtle">
                /{slugPath}
              </span>
            )}
          </span>
        ) : (
          <span className="font-medium">カテゴリを選択</span>
        )}
        <ChevronDown className="ml-1 h-3.5 w-3.5 text-ink-subtle" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 rounded-lg border border-surface-border bg-white shadow-lg">
          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => select(null)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-muted/40",
                !catId && "bg-brand-50/50"
              )}
            >
              <span className="text-ink-muted">未設定</span>
              {!catId && <span className="text-[10px] text-brand-700">●</span>}
            </button>
            <div className="my-1 border-t border-surface-border" />
            {loading ? (
              <div className="px-3 py-3 text-center text-xs text-ink-subtle">
                読み込み中…
              </div>
            ) : options && options.length > 0 ? (
              options.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted/40",
                    c.id === catId && "bg-brand-50/50"
                  )}
                  style={{ paddingLeft: `${0.75 + c.depth * 1}rem` }}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {c.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-ink-subtle">
                      /{c.slug_path}
                    </span>
                  </span>
                  {c.id === catId && (
                    <span className="text-[10px] text-brand-700">●</span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-center text-xs text-ink-subtle">
                カテゴリが登録されていません
              </div>
            )}
          </div>
          <div className="border-t border-surface-border bg-surface-muted/30 px-3 py-2">
            <Link
              href="/admin/articles/categories"
              className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              カテゴリを管理
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
