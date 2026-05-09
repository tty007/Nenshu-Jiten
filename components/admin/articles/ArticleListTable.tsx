"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { deleteArticles } from "@/lib/admin/articles/actions";
import { dismissToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATETIME.format(d);
}

type ArticleRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
  company_count: number;
  companies: Array<{ id: string; name: string; edinet_code: string }>;
};

type Props = {
  rows: ArticleRow[];
  total: number;
};

const STATUS_LABEL: Record<ArticleRow["status"], string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
};
const STATUS_DOT: Record<ArticleRow["status"], string> = {
  draft: "bg-slate-400",
  published: "bg-positive-500",
  archived: "bg-amber-500",
};
const STATUS_TONE: Record<ArticleRow["status"], string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  published: "border-positive/30 bg-positive-50/70 text-positive-700",
  archived: "border-amber-200 bg-amber-50/70 text-amber-800",
};

export function ArticleListTable({ rows, total }: Props) {
  const router = useRouter();
  // Set より plain object のほうが React 19 で安定（参照比較で確実に新規）
  const [selectedMap, setSelectedMap] = useState<Record<string, true>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mountedDom, setMountedDom] = useState(false);
  const headerCheckRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMountedDom(true);
  }, []);

  const selectedIds = useMemo(() => Object.keys(selectedMap), [selectedMap]);
  const selectedCount = selectedIds.length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && !allSelected;

  // indeterminate は DOM プロパティなので useEffect で同期
  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleOne = (id: string) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) {
      setSelectedMap({});
    } else {
      const next: Record<string, true> = {};
      for (const r of rows) next[r.id] = true;
      setSelectedMap(next);
    }
  };
  const clearSelection = () => setSelectedMap({});

  const handleBulkDelete = () => {
    const count = selectedIds.length;
    const loadingId = toast.loading(`${count} 件を削除中…`);
    startTransition(async () => {
      const res = await deleteArticles(selectedIds);
      dismissToast(loadingId);
      if (!res.ok) {
        toast.error(`削除に失敗しました: ${res.error}`);
        setConfirmOpen(false);
        return;
      }
      toast.success(`${res.data.deletedCount} 件を削除しました`);
      setSelectedMap({});
      setConfirmOpen(false);
      router.refresh();
    });
  };

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* ページヘッダー：右側のアクション領域だけ選択状態で差し替える */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">記事一覧</h1>
          <p className="mt-1 text-sm text-ink-muted">
            全{" "}
            <span className="font-numeric font-semibold tabular-nums text-ink">
              {total}
            </span>{" "}
            件
          </p>
        </div>

        <div className="flex shrink-0 items-center">
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50 px-2 py-1.5">
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                {selectedCount}
              </span>
              <span className="text-sm text-ink">件選択中</span>
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-0.5 rounded p-1 text-xs text-ink-muted hover:bg-white hover:text-ink"
                title="選択をクリア"
              >
                <X className="h-3 w-3" />
                クリア
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={isPending}
                className="ml-1 inline-flex items-center gap-1 rounded-md border border-negative bg-white px-3 py-1.5 text-xs font-semibold text-negative-700 hover:bg-negative-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    削除中…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    一括削除
                  </>
                )}
              </button>
            </div>
          ) : (
            <Link
              href="/admin/articles/new"
              className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              新規作成
            </Link>
          )}
        </div>
      </header>


      {/* sticky thead。横スクロールは出さず、タイトル列を可変幅にして他列は固定 */}
      <div className="overflow-y-auto lg:max-h-[calc(100vh-18rem)]">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-10" />
            <col />{/* タイトル：残り全部 */}
            <col className="w-28" />
            <col className="w-52" />
            <col className="w-24" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white text-left text-[11px] uppercase tracking-wide text-ink-subtle">
            <tr className="border-b border-ink/15">
              <th className="whitespace-nowrap px-3 py-2.5">
                <label className="flex h-5 w-5 cursor-pointer items-center justify-center">
                  <input
                    ref={headerCheckRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer accent-brand-600"
                    aria-label="すべて選択"
                  />
                </label>
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">タイトル</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">ステータス</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">関連企業</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">更新</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border text-ink">
            {rows.map((r) => {
              const checked = Boolean(selectedMap[r.id]);
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/admin/articles/${r.id}`)}
                  className={cn(
                    "cursor-pointer transition hover:bg-brand-50/30",
                    checked && "bg-brand-50/60 hover:bg-brand-50/60"
                  )}
                >
                  <td
                    className="w-10 px-3 py-2.5 align-top"
                    onClick={(e) => {
                      // チェックボックス列のクリックは行遷移を止めて選択トグル
                      e.stopPropagation();
                      toggleOne(r.id);
                    }}
                  >
                    <label
                      className="flex h-5 w-5 cursor-pointer items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(r.id)}
                        className="h-4 w-4 cursor-pointer accent-brand-600"
                        aria-label={`${r.title || "（無題）"} を選択`}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div
                      className="truncate font-medium text-ink"
                      title={r.title || "（無題）"}
                    >
                      {r.title || (
                        <span className="text-ink-subtle">（無題）</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top">
                    <StatusTag status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {r.companies.length === 0 ? (
                      <span className="text-xs text-ink-subtle">-</span>
                    ) : (
                      <div
                        className="flex items-center gap-1"
                        title={r.companies.map((c) => c.name).join(", ")}
                      >
                        <span className="inline-flex min-w-0 flex-1 items-center truncate rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink">
                          {r.companies[0].name}
                        </span>
                        {r.companies.length > 1 && (
                          <span className="shrink-0 whitespace-nowrap text-xs text-ink-subtle">
                            +{r.companies.length - 1}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-numeric tabular-nums text-xs text-ink-muted">
                    {fmt(r.updated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 削除確認モーダル：Portal で document.body 直下にレンダリング
          （親要素の transform/backdrop-blur 等が fixed の包含ブロックになるのを回避） */}
      {confirmOpen && mountedDom &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              if (isPending) return;
              setConfirmOpen(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-negative-50">
                  <Trash2 className="h-4 w-4 text-negative-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-ink">
                    {selectedCount} 件の記事を削除しますか？
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    選択した記事と紐付き企業のリレーションが完全に削除されます。元に戻せません。
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isPending}
                  className="rounded-md border border-surface-border bg-white px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-40"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-negative-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-negative-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      削除中…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      {selectedCount} 件を削除
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// =====================================================================
// ステータスタグ
// =====================================================================

function StatusTag({ status }: { status: ArticleRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        STATUS_TONE[status]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          STATUS_DOT[status]
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
