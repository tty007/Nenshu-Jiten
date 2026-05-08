"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryInput,
} from "@/lib/admin/articles/category-actions";
import type { ArticleCategoryWithPath } from "@/lib/admin/articles/get-categories";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Props = { initialCategories: ArticleCategoryWithPath[] };

export function CategoryManager({ initialCategories }: Props) {
  const [categories, setCategories] =
    useState<ArticleCategoryWithPath[]>(initialCategories);
  const [editing, setEditing] = useState<ArticleCategoryWithPath | null>(null);
  const [creating, setCreating] = useState<{ parent_id: string | null } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const refresh = (next: ArticleCategoryWithPath[]) => setCategories(next);

  const allCategories = categories;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating({ parent_id: null })}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink/80 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
        >
          <Plus className="h-4 w-4" />
          新規カテゴリ
        </button>
      </div>

      {/* フラットツリー：DFS 順に並んだものを階層インデント表示 */}
      <div className="border-t border-ink/15">
        {allCategories.length === 0 ? (
          <div className="px-1 py-12 text-center text-sm text-ink-subtle">
            カテゴリが登録されていません。「新規カテゴリ」から追加してください。
          </div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {allCategories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-1 py-3 transition hover:bg-surface-muted/30"
                style={{ paddingLeft: `${c.depth * 1.5 + 0.25}rem` }}
              >
                {c.depth > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-ink-subtle" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-ink">
                      {c.name}
                    </span>
                    <span className="font-mono text-[11px] text-ink-subtle">
                      /{c.slug_path}
                    </span>
                  </div>
                  {c.description && (
                    <div className="mt-0.5 truncate text-[11px] text-ink-muted">
                      {c.description}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {c.is_active ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-positive-700">
                      <Eye className="h-3 w-3" />
                      公開
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                      <EyeOff className="h-3 w-3" />
                      非公開
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCreating({ parent_id: c.id })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-surface-border bg-white px-2.5 py-1 text-xs text-ink hover:bg-surface-muted"
                  title="このカテゴリの下に子カテゴリを追加"
                >
                  <Plus className="h-3 w-3" />
                  子
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-surface-border bg-white px-2.5 py-1 text-xs text-ink hover:bg-surface-muted"
                >
                  <Pencil className="h-3 w-3" />
                  編集
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <CategoryEditModal
          allCategories={allCategories}
          category={editing}
          defaultParentId={creating?.parent_id ?? null}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(null);
            setEditing(null);
            // フル再取得：path の再計算が必要なため
            const res = await fetch("/admin/articles/categories", {
              cache: "no-store",
            });
            // 簡易対応：window.location.reload で OK
            window.location.reload();
          }}
          onDeleted={() => {
            setEditing(null);
            window.location.reload();
          }}
          pending={pending}
          startTransition={startTransition}
        />
      )}
    </div>
  );
}

function CategoryEditModal({
  allCategories,
  category,
  defaultParentId,
  onClose,
  onSaved,
  onDeleted,
  pending,
  startTransition,
}: {
  allCategories: ArticleCategoryWithPath[];
  category: ArticleCategoryWithPath | null;
  defaultParentId: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
  pending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const isNew = !category;
  const [form, setForm] = useState<CategoryInput>({
    parent_id: category?.parent_id ?? defaultParentId,
    slug: category?.slug ?? "",
    name: category?.name ?? "",
    description: category?.description ?? "",
    display_order: category?.display_order ?? 0,
    is_active: category?.is_active ?? true,
  });

  const parentOptions = useMemo(() => {
    // 自身およびその子孫を親候補から除外
    if (!category) return allCategories;
    const excluded = new Set<string>();
    excluded.add(category.id);
    const collectDesc = (id: string) => {
      for (const c of allCategories) {
        if (c.parent_id === id && !excluded.has(c.id)) {
          excluded.add(c.id);
          collectDesc(c.id);
        }
      }
    };
    collectDesc(category.id);
    return allCategories.filter((c) => !excluded.has(c.id));
  }, [allCategories, category]);

  const save = () => {
    if (!form.name?.trim()) return toast.error("カテゴリ名を入力してください");
    if (!form.slug?.trim()) return toast.error("slug を入力してください");
    startTransition(async () => {
      if (isNew) {
        const res = await createCategory(form);
        if (!res.ok) return toast.error(`保存失敗: ${res.error}`);
        toast.success("カテゴリを追加しました");
        onSaved();
      } else {
        const res = await updateCategory(category!.id, form);
        if (!res.ok) return toast.error(`保存失敗: ${res.error}`);
        toast.success("カテゴリを更新しました");
        onSaved();
      }
    });
  };

  const remove = () => {
    if (!category) return;
    if (
      !window.confirm(
        `${category.name} を削除します。続行しますか？（子カテゴリがあると削除できません）`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteCategory(category.id);
      if (!res.ok) return toast.error(`削除失敗: ${res.error}`);
      toast.success("削除しました");
      onDeleted(category.id);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-base font-semibold text-ink">
            {isNew ? "カテゴリを追加" : "カテゴリを編集"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="カテゴリ名（必須）" required>
            <input
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例：年収"
              className="input"
            />
          </Field>
          <Field label="slug（必須）" hint="半角英数とハイフン">
            <input
              value={form.slug ?? ""}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="例：salary"
              className="input font-mono text-xs"
            />
          </Field>
          <Field label="親カテゴリ" hint="トップレベルなら未選択">
            <select
              value={form.parent_id ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  parent_id: e.target.value === "" ? null : e.target.value,
                })
              }
              className="input"
            >
              <option value="">— トップレベル —</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth)}
                  {c.name} （/{c.slug_path}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="説明">
            <textarea
              value={form.description ?? ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="このカテゴリの用途・運用方針など"
              rows={3}
              className="input"
            />
          </Field>
          <Field label="表示順" hint="小さい数字ほど上に表示">
            <input
              type="number"
              value={form.display_order ?? 0}
              onChange={(e) =>
                setForm({
                  ...form,
                  display_order: Number(e.target.value) || 0,
                })
              }
              className="input"
            />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-md border border-surface-border bg-surface-muted/30 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-ink">公開設定</div>
              <div className="text-[11px] text-ink-subtle">
                非公開にすると、新規記事のカテゴリ選択肢から外れます。
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
                className="h-4 w-4"
              />
              <span>公開する</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-border bg-surface-muted/30 px-6 py-3">
          {!isNew ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-negative/40 px-3 py-1.5 text-xs text-negative-700 hover:bg-negative-50/40 disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              削除
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs text-ink hover:bg-surface-muted"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-positive-600 px-4 py-2 text-xs font-semibold text-white hover:bg-positive-700 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
              保存
            </button>
          </div>
        </div>

        <style>{`
          .input {
            width: 100%;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 0.55rem 0.7rem;
            font-size: 0.875rem;
            color: #0f172a;
            background: #fff;
            outline: none;
            transition: border-color 0.12s, box-shadow 0.12s;
          }
          .input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
        `}</style>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-negative-700">*</span>}
        {hint && <span className="text-[10px] text-ink-subtle">（{hint}）</span>}
      </span>
      {children}
    </label>
  );
}
