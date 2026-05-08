"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, User } from "lucide-react";
import { setArticleAuthor } from "@/lib/admin/articles/author-actions";
import { listAuthorsForSelectorClient } from "@/lib/admin/articles/author-client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type AuthorOption = {
  id: string;
  name: string;
  title: string | null;
  avatar_url?: string | null;
};

type Props = {
  articleId: string;
  initialAuthorId: string | null;
  initialAuthorName: string | null;
  initialAuthorTitle: string | null;
  initialAuthorAvatarUrl?: string | null;
};

function AvatarDot({
  url,
  name,
  size = 28,
}: {
  url: string | null;
  name: string | null;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 text-white shadow-inner"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-semibold leading-none">
          {name ? name.slice(0, 1) : ""}
        </span>
      )}
    </span>
  );
}

export function AuthorSelector({
  articleId,
  initialAuthorId,
  initialAuthorName,
  initialAuthorTitle,
  initialAuthorAvatarUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AuthorOption[] | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(initialAuthorId);
  const [authorName, setAuthorName] = useState<string | null>(
    initialAuthorName
  );
  const [authorTitle, setAuthorTitle] = useState<string | null>(
    initialAuthorTitle
  );
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(
    initialAuthorAvatarUrl ?? null
  );
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 開いた時に著者一覧を取得（軽量・公開のみ）
  const ensureLoaded = async () => {
    if (options) return;
    setLoading(true);
    try {
      const list = await listAuthorsForSelectorClient();
      setOptions(list);
    } catch (e) {
      toast.error(`著者の読み込みに失敗: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const select = (next: AuthorOption | null) => {
    const prevId = authorId;
    const prevName = authorName;
    const prevTitle = authorTitle;
    const prevAvatar = authorAvatarUrl;
    // 楽観更新
    setAuthorId(next?.id ?? null);
    setAuthorName(next?.name ?? null);
    setAuthorTitle(next?.title ?? null);
    setAuthorAvatarUrl(next?.avatar_url ?? null);
    setOpen(false);
    startTransition(async () => {
      const res = await setArticleAuthor(articleId, next?.id ?? null);
      if (!res.ok) {
        // ロールバック
        setAuthorId(prevId);
        setAuthorName(prevName);
        setAuthorTitle(prevTitle);
        setAuthorAvatarUrl(prevAvatar);
        toast.error(`保存に失敗: ${res.error}`);
        return;
      }
      toast.success(next ? `著者を「${next.name}」に設定しました` : "著者を未設定に戻しました");
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
          authorId
            ? "border-surface-border text-ink"
            : "border-dashed border-ink/40 text-ink-muted"
        )}
      >
        {authorId && authorName ? (
          <>
            <AvatarDot url={authorAvatarUrl} name={authorName} size={28} />
            <span className="text-left leading-tight">
              <span className="block font-medium text-ink">{authorName}</span>
              {authorTitle && (
                <span className="block text-[11px] text-ink-subtle">
                  {authorTitle}
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <User className="h-4 w-4 text-ink-muted" />
            <span className="font-medium">著者を選択</span>
          </>
        )}
        <ChevronDown className="ml-1 h-3.5 w-3.5 text-ink-subtle" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 rounded-lg border border-surface-border bg-white shadow-lg">
          <div className="max-h-72 overflow-y-auto py-1">
            {/* 未設定オプション */}
            <button
              type="button"
              onClick={() => select(null)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-muted/40",
                !authorId && "bg-brand-50/50"
              )}
            >
              <span className="text-ink-muted">未設定（著者を表示しない）</span>
              {!authorId && <span className="text-[10px] text-brand-700">●</span>}
            </button>

            <div className="my-1 border-t border-surface-border" />

            {loading ? (
              <div className="px-3 py-3 text-center text-xs text-ink-subtle">
                読み込み中…
              </div>
            ) : options && options.length > 0 ? (
              options.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => select(a)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted/40",
                    a.id === authorId && "bg-brand-50/50"
                  )}
                >
                  <AvatarDot url={a.avatar_url ?? null} name={a.name} size={24} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {a.name}
                    </span>
                    {a.title && (
                      <span className="block truncate text-[11px] text-ink-subtle">
                        {a.title}
                      </span>
                    )}
                  </span>
                  {a.id === authorId && (
                    <span className="text-[10px] text-brand-700">●</span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-center text-xs text-ink-subtle">
                登録された著者がいません
              </div>
            )}
          </div>
          <div className="border-t border-surface-border bg-surface-muted/30 px-3 py-2">
            <Link
              href="/admin/articles/authors"
              className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              著者を管理
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
