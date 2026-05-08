"use client";

import { useRef, useState, useTransition } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Upload,
  Loader2,
} from "lucide-react";
import {
  createAuthor,
  deleteAuthor,
  updateAuthor,
  uploadAuthorAvatar,
  type AuthorInput,
} from "@/lib/admin/articles/author-actions";
import type { ArticleAuthor } from "@/lib/admin/articles/get-authors";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Props = {
  initialAuthors: ArticleAuthor[];
};

export function AuthorManager({ initialAuthors }: Props) {
  const [authors, setAuthors] = useState<ArticleAuthor[]>(initialAuthors);
  const [editing, setEditing] = useState<ArticleAuthor | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = (next: ArticleAuthor[]) => setAuthors(next);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink/80 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
        >
          <Plus className="h-4 w-4" />
          新規著者
        </button>
      </div>

      {/* フラットリスト：上下罫線で区切るだけ。カード装飾なし */}
      <div className="border-t border-ink/15">
        {authors.length === 0 ? (
          <div className="border-b border-surface-border px-1 py-12 text-center text-sm text-ink-subtle">
            著者が登録されていません。「新規著者」から追加してください。
          </div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {authors.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-4 px-1 py-3 transition hover:bg-surface-muted/30"
              >
                {/* アバター（未設定時はブランドカラーのグラデ円） */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  {a.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 text-xs font-semibold text-white shadow-inner">
                      {a.name.slice(0, 1)}
                    </div>
                  )}
                </div>

                {/* メイン情報 */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-ink">
                      {a.name}
                    </span>
                    {a.name_kana && (
                      <span className="text-[11px] text-ink-subtle">
                        {a.name_kana}
                      </span>
                    )}
                    {a.title && (
                      <span className="text-xs text-ink-muted">
                        ・{a.title}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-subtle">
                    <span className="font-mono">{a.slug}</span>
                  </div>
                </div>

                {/* 公開フラグ */}
                <div className="shrink-0">
                  {a.is_active ? (
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

                {/* 編集 */}
                <button
                  type="button"
                  onClick={() => setEditing(a)}
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
        <AuthorEditModal
          author={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(saved) => {
            const idx = authors.findIndex((a) => a.id === saved.id);
            if (idx >= 0) {
              const next = [...authors];
              next[idx] = saved;
              refresh(next);
            } else {
              refresh([...authors, saved]);
            }
            setCreating(false);
            setEditing(null);
          }}
          onDeleted={(id) => {
            refresh(authors.filter((a) => a.id !== id));
            setEditing(null);
          }}
          pending={pending}
          startTransition={startTransition}
        />
      )}
    </div>
  );
}

// =====================================================================

function AuthorEditModal({
  author,
  onClose,
  onSaved,
  onDeleted,
  pending,
  startTransition,
}: {
  author: ArticleAuthor | null;
  onClose: () => void;
  onSaved: (a: ArticleAuthor) => void;
  onDeleted: (id: string) => void;
  pending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const [form, setForm] = useState<AuthorInput>({
    slug: author?.slug ?? "",
    name: author?.name ?? "",
    name_kana: author?.name_kana ?? "",
    title: author?.title ?? "",
    bio: author?.bio ?? "",
    avatar_url: author?.avatar_url ?? "",
    is_active: author?.is_active ?? true,
    display_order: author?.display_order ?? 0,
  });

  const isNew = !author;

  const save = () => {
    if (!form.name?.trim()) {
      toast.error("著者名を入力してください");
      return;
    }
    startTransition(async () => {
      if (isNew) {
        const res = await createAuthor(form);
        if (!res.ok) return toast.error(`保存失敗: ${res.error}`);
        toast.success("著者を追加しました");
        onSaved({
          id: res.data.id,
          slug: form.slug?.trim() || "",
          name: form.name!.trim(),
          name_kana: form.name_kana?.trim() || null,
          title: form.title?.trim() || null,
          bio: form.bio?.trim() || null,
          avatar_url: form.avatar_url?.trim() || null,
          is_active: form.is_active ?? true,
          display_order: form.display_order ?? 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        const res = await updateAuthor(author!.id, form);
        if (!res.ok) return toast.error(`保存失敗: ${res.error}`);
        toast.success("著者を更新しました");
        onSaved({
          ...author!,
          ...form,
          name: form.name!.trim(),
          name_kana: form.name_kana?.trim() || null,
          title: form.title?.trim() || null,
          bio: form.bio?.trim() || null,
          avatar_url: form.avatar_url?.trim() || null,
          is_active: form.is_active ?? true,
          display_order: form.display_order ?? 0,
          updated_at: new Date().toISOString(),
        } as ArticleAuthor);
      }
    });
  };

  const remove = () => {
    if (!author) return;
    if (
      !window.confirm(
        `${author.name} を削除します。紐付いている記事の著者は「未設定」に戻ります。続行しますか？`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteAuthor(author.id);
      if (!res.ok) return toast.error(`削除失敗: ${res.error}`);
      toast.success("削除しました");
      onDeleted(author.id);
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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-base font-semibold text-ink">
            {isNew ? "著者を追加" : "著者を編集"}
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
          {/* アバター：モーダル上部・中央配置。クリックで画像選択 */}
          <div className="flex justify-center pt-1">
            <AvatarUploader
              value={form.avatar_url ?? null}
              onChange={(url) => setForm({ ...form, avatar_url: url })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="著者名（必須）" required>
              <input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：山田 太郎"
                className="input"
              />
            </Field>
            <Field label="読み（カナ）">
              <input
                value={form.name_kana ?? ""}
                onChange={(e) =>
                  setForm({ ...form, name_kana: e.target.value })
                }
                placeholder="例：ヤマダ タロウ"
                className="input"
              />
            </Field>
            <Field label="肩書き">
              <input
                value={form.title ?? ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例：編集長 / 主任ライター"
                className="input"
              />
            </Field>
            <Field label="slug（/authors/{slug}）" hint="半角英数とハイフン">
              <input
                value={form.slug ?? ""}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="例：taro-yamada"
                className="input font-mono text-xs"
              />
            </Field>
          </div>

          <Field label="自己紹介（150〜400 字）">
            <textarea
              value={form.bio ?? ""}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="経歴・専門領域・編集方針"
              rows={4}
              className="input"
            />
          </Field>

          <div className="flex items-center justify-between gap-3 rounded-md border border-surface-border bg-surface-muted/30 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-ink">公開設定</div>
              <div className="text-[11px] text-ink-subtle">
                非公開にすると記事フッターの著者カードに表示されなくなります。
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

// =====================================================================
// アバターアップローダー
// =====================================================================

function AvatarUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadAuthorAvatar(fd);
      if (!res.ok) {
        toast.error(`アップロード失敗: ${res.error}`);
        return;
      }
      onChange(res.data.url);
      toast.success("画像をアップロードしました");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        aria-label="アバター画像を選択"
        className="group relative h-28 w-28 overflow-hidden rounded-full transition disabled:opacity-60"
      >
        {value ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover transition group-hover:opacity-80"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 text-white shadow-inner transition group-hover:from-brand-400 group-hover:via-brand-500 group-hover:to-brand-700">
            <Upload className="mb-1 h-5 w-5" />
            <span className="text-[11px]">画像を選択</span>
          </div>
        )}
        {/* ホバー時：差し替えオーバーレイ */}
        {value && !uploading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
            <Upload className="h-5 w-5" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleSelect}
        disabled={uploading}
        className="hidden"
      />
      <p className="text-[11px] text-ink-subtle">
        クリックで画像を選択（2 MB まで・JPG/PNG/WebP/GIF）
      </p>
    </div>
  );
}
