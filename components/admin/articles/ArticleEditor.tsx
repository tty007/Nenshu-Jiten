"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Eye,
  Save,
  Trash2,
} from "lucide-react";
import { saveArticle, deleteArticle } from "@/lib/admin/articles/actions";
import {
  findCategoryBySlugPathClient,
  setArticleCategory,
} from "@/lib/admin/articles/category-actions";
import type { ArticleStatus } from "@/lib/admin/articles/get-articles";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAdminSidebar } from "@/components/admin/AdminShell";
import { TipTapEditor, type EditorHandle } from "./TipTapEditor";
import { CompanySelector, type CompanyChip } from "./CompanySelector";
import { RightSidebar } from "./RightSidebar";
import { AuthorSelector } from "./AuthorSelector";
import { CategorySelector } from "./CategorySelector";
import { SlugEditor } from "./SlugEditor";
import { XbrlDocSelector } from "./XbrlDocSelector";
import {
  autoLinkXbrlDocsForArticle,
  listArticleXbrlDocs,
  type ArticleXbrlDocChip,
} from "@/lib/admin/articles/xbrl-actions";
import { setArticleAuthor } from "@/lib/admin/articles/author-actions";

type Props = {
  articleId: string;
  initialTitle: string;
  initialBodyHtml: string;
  initialBodyJson: unknown | null;
  initialStatus: ArticleStatus;
  initialCompanies: CompanyChip[];
  initialAuthor: {
    id: string;
    name: string;
    title: string | null;
    avatar_url: string | null;
  } | null;
  initialCategory: {
    id: string;
    slug_path: string;
    name_path: string;
  } | null;
  initialSlug: string | null;
  initialXbrlDocs: ArticleXbrlDocChip[];
  updatedAt: string;
};

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
};
const STATUS_TONE: Record<ArticleStatus, string> = {
  draft: "bg-surface-muted text-ink-muted",
  published: "bg-positive-50 text-positive-700",
  archived: "bg-amber-50 text-amber-800",
};
const STATUS_DROPDOWN_TONE: Record<ArticleStatus, string> = {
  draft: "border-surface-border bg-white text-ink",
  published: "border-positive/40 bg-positive-50 text-positive-800",
  archived: "border-amber-200 bg-amber-50 text-amber-800",
};

export function ArticleEditor({
  articleId,
  initialTitle,
  initialBodyHtml,
  initialBodyJson,
  initialStatus,
  initialCompanies,
  initialAuthor,
  initialCategory,
  initialSlug,
  initialXbrlDocs,
  updatedAt,
}: Props) {
  const router = useRouter();
  const sidebar = useAdminSidebar();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<ArticleStatus>(initialStatus);
  // 紐付き企業（AI 執筆 / 右サイドバーのテンプレ生成で使用）
  const [companies, setCompanies] = useState<CompanyChip[]>(initialCompanies);
  // 紐付き有報書類（複数）。テンプレ反映時の auto-link 後にも親で更新される
  const [xbrlDocs, setXbrlDocs] = useState<ArticleXbrlDocChip[]>(initialXbrlDocs);
  const [savedAt, setSavedAt] = useState<string>(updatedAt);
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [metaOpen, setMetaOpen] = useState<boolean>(true);
  // パネルが完全に開いた後（アニメ終了後）のみ true。
  // overflow-hidden を解除して内部のドロップダウン (AuthorSelector / CategorySelector 等) が
  // 親の枠外まで降りられるようにするためのフラグ。
  const [metaSettled, setMetaSettled] = useState<boolean>(true);
  // メタ情報パネルの開閉を localStorage に保存
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        "admin-article-meta-open"
      );
      if (stored === "0") {
        setMetaOpen(false);
        setMetaSettled(false);
      }
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "admin-article-meta-open",
        metaOpen ? "1" : "0"
      );
    } catch {
      /* noop */
    }
    // 開閉アニメ (300ms) が終わってから overflow を解除／適用する
    if (metaOpen) {
      const t = window.setTimeout(() => setMetaSettled(true), 320);
      return () => window.clearTimeout(t);
    }
    setMetaSettled(false);
  }, [metaOpen]);
  const [categorySlugPath, setCategorySlugPath] = useState<string | null>(
    initialCategory?.slug_path ?? null
  );
  // テンプレ一括反映時に強制セットされたカテゴリ（CategorySelector 内 UI 同期用）
  const [forcedCategory, setForcedCategory] = useState<{
    id: string;
    slug_path: string;
    name_path: string;
  } | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();
  const editorHandleRef = useRef<EditorHandle | null>(null);

  // カテゴリ + 企業から自動生成される「auto-prefix」
  //   <category-path>/<edinet-codes-joined-by-hyphen>
  // 企業が無ければ <category-path> のみ
  // どちらも未設定なら null（自動部分なし）
  // 末尾セグメント（ユーザ入力）は SlugEditor 側で別管理。
  const autoSlugPrefix = useMemo(() => {
    const cat = categorySlugPath?.trim();
    const codes = companies
      .map((c) => c.edinet_code)
      .filter((s): s is string => Boolean(s))
      .join("-"); // 大小はそのまま保持（EDINET コードは E12345 のような大文字）
    if (cat && codes) return `${cat}/${codes}`;
    if (cat) return cat;
    if (codes) return codes;
    return null;
  }, [categorySlugPath, companies]);

  const bodyRef = useRef<{ html: string; json: unknown }>({
    html: initialBodyHtml,
    json: initialBodyJson,
  });
  const [dirty, setDirty] = useState(false);
  // 本文 + タイトルの合計文字数（HTML タグを除いたテキスト長）
  const [bodyCharCount, setBodyCharCount] = useState<number>(() =>
    countText(initialBodyHtml)
  );
  const titleInitial = useRef(initialTitle);

  useEffect(() => {
    if (title !== titleInitial.current) setDirty(true);
  }, [title]);

  const onEditorUpdate = ({ html, json }: { html: string; json: unknown }) => {
    bodyRef.current = { html, json };
    setDirty(true);
    setBodyCharCount(countText(html));
  };

  const totalChars = bodyCharCount + title.length;

  const handleSave = (nextStatus?: ArticleStatus) => {
    startSaveTransition(async () => {
      const res = await saveArticle(articleId, {
        title,
        body_html: bodyRef.current.html,
        body_json: bodyRef.current.json,
        status: nextStatus ?? status,
      });
      if (!res.ok) {
        toast.error(`保存に失敗しました: ${res.error}`);
        return;
      }
      setSavedAt(new Date().toISOString());
      setDirty(false);
      titleInitial.current = title;
      if (nextStatus) {
        setStatus(nextStatus);
        if (nextStatus === "published") {
          // 公開ページ URL を表示し、クリップボードにもコピー（slug 優先）
          const url = `${window.location.origin}/articles/${slug ?? articleId}`;
          try {
            await navigator.clipboard?.writeText(url);
            toast.success(`公開しました（URL をコピー）: ${url}`, 8_000);
          } catch {
            toast.success(`公開しました: ${url}`, 8_000);
          }
        } else {
          toast.success(
            nextStatus === "archived" ? "アーカイブしました" : "下書きに戻しました"
          );
        }
      } else {
        toast.success("保存しました");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("この記事を削除します。元に戻せません。よろしいですか？")) return;
    startMutateTransition(async () => {
      const res = await deleteArticle(articleId);
      if (!res.ok) {
        toast.error(`削除に失敗しました: ${res.error}`);
        return;
      }
      toast.success("削除しました");
      router.push("/admin/articles");
    });
  };

  // Cmd/Ctrl + S で保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, status]);

  return (
    <div>
      {/* 上部バー：サイトヘッダー (h-16) の下に sticky */}
      <div className="sticky top-16 z-20 -mx-6 mb-5 mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface-muted/85 px-6 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {sidebar && (
          <button
            type="button"
            onClick={sidebar.toggle}
            aria-label={sidebar.collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
            className="group inline-flex items-center gap-1 text-sm text-ink-muted underline-offset-4 transition hover:text-brand-700 hover:underline"
          >
            {sidebar.collapsed ? (
              <>
                <ChevronsRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                <span>サイドバーを開く</span>
              </>
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
                <span>サイドバーを閉じる</span>
              </>
            )}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-subtle">
            {dirty ? "未保存の変更あり" : `保存済み: ${fmtDateTime(savedAt)}`}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium text-ink-muted"
            title="本文＋タイトルの合計文字数（HTML タグ除外）"
          >
            <span className="font-numeric tabular-nums text-ink">
              {totalChars.toLocaleString("ja-JP")}
            </span>
            <span>字</span>
          </span>
          {status === "published" && (
            <Link
              href={`/articles/${slug ?? articleId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="公開ページを別タブで開く（読者と同じビュー）"
              className="inline-flex items-center gap-1.5 rounded-md border border-positive/40 bg-positive-50 px-3 py-1.5 text-xs font-semibold text-positive-800 transition hover:bg-positive-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              公開ページ
            </Link>
          )}
          <Link
            href={`/admin/articles/${articleId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            title="読者目線のプレビューを別タブで開く"
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-4 py-2 text-xs font-medium text-ink shadow-sm transition hover:bg-surface-muted"
          >
            <Eye className="h-3.5 w-3.5" />
            プレビュー
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isMutating}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            削除
          </button>

          {/* ステータスのドロップダウン：選択しても即保存はしない。右の「保存」で確定 */}
          <div className="relative inline-flex items-center">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ArticleStatus);
                setDirty(true);
              }}
              disabled={isSaving}
              className={cn(
                "appearance-none rounded-md border px-3 py-2 pr-8 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-40",
                STATUS_DROPDOWN_TONE[status]
              )}
              aria-label="記事ステータス"
              title="保存時にこのステータスで確定されます"
            >
              <option value="draft">下書き</option>
              <option value="published">公開</option>
              <option value="archived">アーカイブ</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-ink-muted" />
          </div>

          {/* 保存ボタン：右端に配置 */}
          <button
            type="button"
            onClick={() => handleSave(status)}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-100 px-5 py-2 text-xs font-semibold text-brand-800 shadow-sm transition hover:bg-brand-200 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            保存 (⌘S)
          </button>
        </div>
      </div>

      {/* note 風の中央寄せ */}
      <article className="mx-auto max-w-3xl">
        {/* メタ情報パネル：トグルで開閉可能。開いている時のみ下罫線 */}
        <div
          className={cn(
            "mb-8 transition-colors",
            metaOpen ? "border-b border-surface-border" : ""
          )}
        >
          <button
            type="button"
            onClick={() => setMetaOpen((v) => !v)}
            aria-expanded={metaOpen}
            className={cn(
              "group flex w-full items-center gap-3 px-1 py-4 text-left transition",
              metaOpen
                ? "border-b border-surface-border hover:border-ink/40"
                : ""
            )}
          >
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-ink-muted transition-transform group-hover:text-ink",
                metaOpen ? "rotate-0" : "-rotate-90"
              )}
            />
            <span className="text-base font-semibold text-ink">メタ情報</span>
            <span className="text-xs text-ink-subtle">
              関連企業 / 著者 / カテゴリ / スラッグ
            </span>
            {!metaOpen && (
              <span className="ml-2 truncate text-sm text-ink-subtle">
                {[
                  companies.length > 0 ? `企業 ${companies.length}` : null,
                  initialAuthor?.name ? `著者 ${initialAuthor.name}` : null,
                  initialCategory?.name_path
                    ? `カテゴリ ${initialCategory.name_path}`
                    : null,
                  slug ? `slug /${slug}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "未設定"}
              </span>
            )}
          </button>
          {/* CSS grid トリックで height: auto への滑らか遷移 */}
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out",
              metaOpen
                ? "mt-6 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0"
            )}
            aria-hidden={!metaOpen}
          >
            <div className={metaSettled ? "overflow-visible" : "overflow-hidden"}>
              <div className="space-y-3 pb-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex w-24 shrink-0 items-center justify-center self-stretch border-r border-surface-border px-2 py-1 text-sm font-semibold tracking-wide text-ink-muted">
                  関連企業
                </span>
                <CompanySelector
                  articleId={articleId}
                  initialCompanies={initialCompanies}
                  onChange={(next) => setCompanies(next)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex w-24 shrink-0 items-center justify-center self-stretch border-r border-surface-border px-2 py-1 text-sm font-semibold tracking-wide text-ink-muted">
                  有報情報
                </span>
                <XbrlDocSelector
                  articleId={articleId}
                  initialDocs={xbrlDocs}
                  companyEdinetCodes={companies.map((c) => c.edinet_code)}
                  onChange={(next) => setXbrlDocs(next)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex w-24 shrink-0 items-center justify-center self-stretch border-r border-surface-border px-2 py-1 text-sm font-semibold tracking-wide text-ink-muted">
                  著者
                </span>
                <AuthorSelector
                  articleId={articleId}
                  initialAuthorId={initialAuthor?.id ?? null}
                  initialAuthorName={initialAuthor?.name ?? null}
                  initialAuthorTitle={initialAuthor?.title ?? null}
                  initialAuthorAvatarUrl={initialAuthor?.avatar_url ?? null}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex w-24 shrink-0 items-center justify-center self-stretch border-r border-surface-border px-2 py-1 text-sm font-semibold tracking-wide text-ink-muted">
                  カテゴリ
                </span>
                <CategorySelector
                  articleId={articleId}
                  initialCategoryId={initialCategory?.id ?? null}
                  initialCategoryNamePath={initialCategory?.name_path ?? null}
                  initialCategorySlugPath={initialCategory?.slug_path ?? null}
                  externalCategory={forcedCategory}
                  onCategoryChange={(c) => {
                    setCategorySlugPath(c.slug_path);
                  }}
                />
              </div>
              <div className="flex flex-nowrap items-center gap-x-3 gap-y-1.5">
                <span className="flex w-24 shrink-0 items-center justify-center self-stretch border-r border-surface-border px-2 py-1 text-sm font-semibold tracking-wide text-ink-muted">
                  スラッグ
                </span>
                <SlugEditor
                  articleId={articleId}
                  initialSlug={initialSlug}
                  onSlugChange={(s) => setSlug(s)}
                  autoPrefix={autoSlugPrefix}
                />
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* タイトル */}
        <textarea
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            // textarea の自動 height 調整
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }
          }}
          rows={1}
          placeholder="タイトルを入力"
          className="mb-2 w-full resize-none border-0 bg-transparent p-0 text-3xl font-bold leading-[2] tracking-[0.01em] text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0 sm:text-4xl"
        />

        {/* 本文エディタ：ボーダーなし */}
        <TipTapEditor
          // body_html を優先する。過去に body_json が level 等の attrs を欠落
          // させた状態で保存されているケースがあり、その場合 JSON 側を信頼すると
          // 全見出しが h1 として表示されてしまうため、確実に正規化された
          // HTML 側を一次ソースとして扱う。
          initialContent={initialBodyHtml || initialBodyJson || ""}
          onUpdate={onEditorUpdate}
          articleId={articleId}
          companyCount={companies.length}
          onReady={(handle) => {
            editorHandleRef.current = handle;
          }}
        />
      </article>

      {/* 右サイドバー：テンプレ管理（ツマミから開閉） */}
      <RightSidebar
        articleId={articleId}
        companies={companies}
        initialAuthorId={initialAuthor?.id ?? null}
        onInsert={(html) => {
          editorHandleRef.current?.appendContent(html);
        }}
        onInsertAtCursor={(html) => {
          editorHandleRef.current?.insertAtCursor(html);
        }}
        onReplace={(html) => {
          editorHandleRef.current?.setContent(html);
        }}
        onApplyTitle={(t) => {
          setTitle(t);
          setDirty(true);
        }}
        onApplyCategoryBySlug={async (slugPath) => {
          // slug でカテゴリを検索 → DB 更新 → CategorySelector の表示同期
          const cat = await findCategoryBySlugPathClient(slugPath);
          if (!cat) {
            toast.error(
              `カテゴリ "${slugPath}" が見つかりません。/admin/articles/categories で作成してください`
            );
            return;
          }
          const res = await setArticleCategory(articleId, cat.id);
          if (!res.ok) {
            toast.error(`カテゴリ自動設定失敗: ${res.error}`);
            return;
          }
          setCategorySlugPath(cat.slug_path);
          setForcedCategory(cat);
        }}
        onApplyAuthor={async (authorId) => {
          const res = await setArticleAuthor(articleId, authorId);
          if (!res.ok) {
            toast.error(`著者自動設定失敗: ${res.error}`);
            return;
          }
          // ArticleEditor 側の AuthorSelector は initialAuthorId を受け取るのみで
          // 反映後の同期は次回再レンダーに委ねる（Next.js のキャッシュ revalidate により
          // 編集画面に戻った際に最新が表示される）
        }}
        onAutoLinkXbrlDocs={async () => {
          const res = await autoLinkXbrlDocsForArticle(articleId);
          if (!res.ok) {
            toast.error(`有報リンク失敗: ${res.error}`);
            return;
          }
          // 成功後、最新の有報リストを取り直して state 同期
          const list = await listArticleXbrlDocs(articleId);
          if (list.ok) setXbrlDocs(list.data);
        }}
      />
    </div>
  );
}

const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATETIME.format(d);
}

/**
 * HTML から見出し含む可視テキストの文字数をカウント。
 * <script>/<style> は除外、Unicode 単位（絵文字含む）でグラフェムを数える。
 */
function countText(html: string): number {
  if (!html) return 0;
  if (typeof document === "undefined") {
    // SSR：タグ除去のみの粗い計算
    const txt = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return Array.from(txt).length;
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("script, style").forEach((n) => n.remove());
  const text = (div.textContent ?? "").replace(/\s+/g, " ").trim();
  return Array.from(text).length;
}
