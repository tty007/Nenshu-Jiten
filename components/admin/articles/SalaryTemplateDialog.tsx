"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  RotateCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  AI_MODELS,
  formatUsd,
  type AiModelId,
} from "@/lib/admin/articles/ai-write-prompt";
import {
  generateSalarySection,
  generateSalaryTitle,
  getSalaryDataSourceMeta,
  type SalaryDataSourceMeta,
} from "@/lib/admin/articles/salary-template/actions";
import type { SalaryTitleResult } from "@/lib/admin/articles/salary-template/generators";
import {
  SALARY_KIND_LABEL,
  SALARY_SECTIONS,
  SALARY_TOTAL_EST_COST_USD,
  type SalarySectionDef,
} from "@/lib/admin/articles/salary-template/sections";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { CompanyChip } from "./CompanySelector";

type SectionStatus = "idle" | "generating" | "done" | "error";

type SectionRuntime = {
  status: SectionStatus;
  html?: string;
  error?: string;
  cost_usd?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  articleId: string;
  company: CompanyChip | null;
  /** エディタ末尾に追記（フッターの「末尾に追記」ボタン用） */
  onInsert: (html: string) => void;
  /** エディタの現在カーソル位置に挿入（個別セクションの「挿入」ボタン用） */
  onInsertAtCursor?: (html: string) => void;
  /** 全セクションをまとめてエディタ全体を置き換え */
  onReplace: (html: string) => void;
  /** 生成済みタイトルをエディタタイトルへ反映（任意） */
  onApplyTitle?: (title: string) => void;
  /**
   * 一括反映時にカテゴリを slug_path で自動セット（例: "salary"）。
   * 親側で setArticleCategory + UI 更新まで責任を持つ。
   */
  onApplyCategoryBySlug?: (slugPath: string) => Promise<void> | void;
  /** エディタへ反映成功直後に呼ばれる（テンプレウィジェットを畳むなど） */
  onAfterApply?: () => void;
  /**
   * テンプレ反映直後に「使用した有報書類」を articles に自動リンクする callback。
   * ArticleEditor 側で autoLinkXbrlDocsForArticle を呼んで、紐付き有報 state を更新する。
   */
  onAutoLinkXbrlDocs?: () => Promise<void> | void;
};

const KIND_TONE: Record<SalarySectionDef["kind"], string> = {
  deterministic: "bg-positive-50 text-positive-700",
  ai: "bg-brand-50 text-brand-700",
  hybrid: "bg-amber-50 text-amber-800",
  placeholder: "bg-surface-muted text-ink-muted",
};

// セクション毎の予想所要秒数。AI セクションは est_cost_usd を用いて
// 「ベース秒 + cost × 係数」で重み、決定論的セクションは固定の小さな値。
// 個別 generate ボタンの所要見積りや、バッチ全体 ETA の計算に利用。
const SECTION_EST_SECONDS: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const s of SALARY_SECTIONS) {
    map[s.id] =
      s.est_cost_usd > 0 ? 4 + s.est_cost_usd * 4000 : 0.5; // 例：cost 0.0017 → 約 11s
  }
  return map;
})();
const TOTAL_EST_SECONDS = Object.values(SECTION_EST_SECONDS).reduce(
  (a, b) => a + b,
  0
);

/** 表示揺れを抑えるため 5/15/30 秒刻みにスナップ */
function snapEta(sec: number): number {
  if (sec < 60) return Math.max(5, Math.round(sec / 5) * 5);
  if (sec < 300) return Math.round(sec / 15) * 15;
  return Math.round(sec / 30) * 30;
}

const STATUS_LABEL: Record<SectionStatus, string> = {
  idle: "未生成",
  generating: "生成中",
  done: "完了",
  error: "失敗",
};

export function SalaryTemplateDialog({
  open,
  onClose,
  articleId,
  company,
  onInsert,
  onInsertAtCursor,
  onReplace,
  onApplyTitle,
  onApplyCategoryBySlug,
  onAfterApply,
  onAutoLinkXbrlDocs,
}: Props) {
  const [mountedDom, setMountedDom] = useState(false);
  const [model] = useState<AiModelId>("gpt-4o-mini");
  const [runtime, setRuntime] = useState<Record<string, SectionRuntime>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [batchProgress, setBatchProgress] = useState<{
    completed: number;
    total: number;
    currentLabel: string | null;
    okCount: number;
    failCount: number;
    /** バッチが完了済みか（完了時に summary を表示） */
    finished: boolean;
    /** 開始時刻（ms） */
    startedAt: number;
    /** 経過秒数（プログレスバーの細かい同期用） */
    elapsedSec: number;
    /** 直近キャリブレーション時点の残り推定秒数。
     *  以降は (now - etaUpdatedAt) を引くだけで滑らかにカウントダウン。 */
    etaSec: number;
    etaUpdatedAt: number;
  } | null>(null);

  // タイトル生成（決定論的・即時）
  const [titleData, setTitleData] = useState<SalaryTitleResult | null>(null);
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [includeTitle, setIncludeTitle] = useState(true);

  // 使用する有報データのメタ情報（モーダルを開いた時に表示）
  const [dataSource, setDataSource] = useState<SalaryDataSourceMeta | null>(null);
  const [dataSourceLoading, setDataSourceLoading] = useState(false);
  const [dataSourceError, setDataSourceError] = useState<string | null>(null);

  // 「エディタに反映」確認モーダル
  const [confirmingApply, setConfirmingApply] = useState(false);

  useEffect(() => {
    setMountedDom(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !batchRunning && !confirmingApply) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, batchRunning, confirmingApply, onClose]);

  // バッチ実行中、1 秒毎に elapsedSec を更新（残り推定時間の表示が動く）
  useEffect(() => {
    if (!batchProgress || batchProgress.finished) return;
    const tid = window.setInterval(() => {
      setBatchProgress((prev) =>
        prev && !prev.finished
          ? {
              ...prev,
              elapsedSec: Math.max(0, (Date.now() - prev.startedAt) / 1000),
            }
          : prev
      );
    }, 1000);
    return () => window.clearInterval(tid);
  }, [batchProgress?.startedAt, batchProgress?.finished]);

  // ダイアログオープン時にタイトル候補を自動生成（即時・コスト 0）
  useEffect(() => {
    if (!open || !articleId || !company) return;
    let cancelled = false;
    setTitleLoading(true);
    setTitleError(null);
    generateSalaryTitle(articleId).then((res) => {
      if (cancelled) return;
      setTitleLoading(false);
      if (res.ok) setTitleData(res.data);
      else setTitleError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, articleId, company]);

  const refetchTitle = () => {
    if (!articleId) return;
    setTitleLoading(true);
    setTitleError(null);
    generateSalaryTitle(articleId).then((res) => {
      setTitleLoading(false);
      if (res.ok) setTitleData(res.data);
      else setTitleError(res.error);
    });
  };

  // 開いたタイミングで「使用する最新有報データ」のメタ情報を取得
  useEffect(() => {
    if (!open || !articleId || !company) {
      setDataSource(null);
      setDataSourceError(null);
      return;
    }
    let cancelled = false;
    setDataSourceLoading(true);
    setDataSourceError(null);
    getSalaryDataSourceMeta(articleId).then((res) => {
      if (cancelled) return;
      setDataSourceLoading(false);
      if (res.ok) setDataSource(res.data);
      else setDataSourceError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, articleId, company]);

  // 統計
  const stats = useMemo(() => {
    const entries = Object.values(runtime);
    const done = entries.filter((r) => r.status === "done").length;
    const errors = entries.filter((r) => r.status === "error").length;
    const totalCost = entries.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
    return { done, errors, totalCost };
  }, [runtime]);

  const setSectionStatus = (id: string, patch: Partial<SectionRuntime>) => {
    setRuntime((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { status: "idle" }), ...patch },
    }));
  };

  const generateOne = async (
    section: SalarySectionDef
  ): Promise<{ ok: boolean }> => {
    setSectionStatus(section.id, {
      status: "generating",
      error: undefined,
    });
    const res = await generateSalarySection({
      articleId,
      sectionId: section.id,
      model,
    });
    if (!res.ok) {
      setSectionStatus(section.id, { status: "error", error: res.error });
      return { ok: false };
    }
    setSectionStatus(section.id, {
      status: "done",
      html: res.data.html,
      cost_usd: res.data.usage.cost_usd,
      error: undefined,
    });
    return { ok: true };
  };

  const handleGenerateOne = async (section: SalarySectionDef) => {
    const r = await generateOne(section);
    if (r.ok) {
      toast.success(`${section.title} を生成しました`);
    } else {
      toast.error(`${section.title} の生成に失敗しました`);
    }
  };

  const handleGenerateAll = async () => {
    if (batchRunning) return;
    setBatchRunning(true);
    const total = SALARY_SECTIONS.length;
    let okCount = 0;
    let failCount = 0;
    const startedAt = Date.now();

    // ===== ETA 計算用のローカル変数（クロージャに保持してチラつきを抑える） =====
    // 「実時間 / 推定時間」の係数を EMA で平滑化。値 1.0 は推定通り、>1 は遅め、<1 は速め。
    let factorSmoothed = 1.0;
    let completedEstSecondsSum = 0;

    setBatchProgress({
      completed: 0,
      total,
      currentLabel: SALARY_SECTIONS[0]?.title ?? null,
      okCount: 0,
      failCount: 0,
      finished: false,
      startedAt,
      elapsedSec: 0,
      etaSec: TOTAL_EST_SECONDS,
      etaUpdatedAt: startedAt,
    });

    for (let i = 0; i < SALARY_SECTIONS.length; i++) {
      const sec = SALARY_SECTIONS[i];
      // 開始時：「現在のセクション」を更新
      setBatchProgress((prev) =>
        prev ? { ...prev, currentLabel: sec.title } : prev
      );
      const r = await generateOne(sec);
      if (r.ok) okCount++;
      else failCount++;

      // ===== ETA キャリブレーション =====
      completedEstSecondsSum += SECTION_EST_SECONDS[sec.id] ?? 0;
      const elapsed = (Date.now() - startedAt) / 1000;
      // 実観測係数 = 実経過 / 完了分の推定合計
      const observed =
        completedEstSecondsSum > 0
          ? elapsed / completedEstSecondsSum
          : factorSmoothed;
      // EMA：50/50 で前値とブレンド（外れ値を吸収）
      factorSmoothed = 0.5 * observed + 0.5 * factorSmoothed;
      // 残推定 = 残セクション分の est_cost ベース秒 × 平滑係数
      const remainingEstSeconds = TOTAL_EST_SECONDS - completedEstSecondsSum;
      const newEtaSec = Math.max(0, factorSmoothed * remainingEstSeconds);
      const etaUpdatedAt = Date.now();

      setBatchProgress((prev) =>
        prev
          ? {
              ...prev,
              completed: i + 1,
              okCount,
              failCount,
              currentLabel:
                i + 1 < SALARY_SECTIONS.length
                  ? SALARY_SECTIONS[i + 1].title
                  : null,
              etaSec: newEtaSec,
              etaUpdatedAt,
            }
          : prev
      );
    }
    setBatchProgress((prev) =>
      prev
        ? {
            ...prev,
            currentLabel: null,
            finished: true,
            etaSec: 0,
            etaUpdatedAt: Date.now(),
          }
        : prev
    );
    setBatchRunning(false);
  };

  const handleInsertOne = (section: SalarySectionDef) => {
    const r = runtime[section.id];
    if (!r?.html) return;
    // 編集中のカーソル位置に挿入（onInsertAtCursor 未提供時は末尾追記にフォールバック）
    if (onInsertAtCursor) {
      onInsertAtCursor(`\n${r.html}\n`);
      toast.success(`${section.title} をカーソル位置に挿入しました`);
    } else {
      onInsert(`\n${r.html}\n`);
      toast.success(`${section.title} を本文末尾に追記しました`);
    }
  };

  /** 反映ボタン押下：実行前に確認モーダルを開くだけ */
  const handleApplyAllRequest = () => {
    const ordered = SALARY_SECTIONS.filter(
      (s) => runtime[s.id]?.status === "done" && runtime[s.id]?.html
    );
    if (ordered.length === 0) {
      toast.error("生成済みのセクションがありません");
      return;
    }
    setConfirmingApply(true);
  };

  /** 確認モーダルで「反映する」を押した後の本処理 */
  const handleApplyAllConfirmed = async () => {
    const ordered = SALARY_SECTIONS.filter(
      (s) => runtime[s.id]?.status === "done" && runtime[s.id]?.html
    );
    if (ordered.length === 0) {
      setConfirmingApply(false);
      return;
    }
    const html = ordered.map((s) => runtime[s.id]?.html ?? "").join("\n\n");
    onReplace(html);
    let titleApplied = false;
    if (includeTitle && titleData?.title && onApplyTitle) {
      onApplyTitle(titleData.title);
      titleApplied = true;
    }
    // 年収カテゴリ（slug=salary）を自動でセット
    if (onApplyCategoryBySlug) {
      try {
        await onApplyCategoryBySlug("salary");
      } catch (e) {
        // 失敗しても本体反映は続行
        console.warn("auto-apply category failed", e);
      }
    }
    // 紐付き企業の最新有報を articles に自動リンク
    if (onAutoLinkXbrlDocs) {
      try {
        await onAutoLinkXbrlDocs();
      } catch (e) {
        console.warn("auto-link xbrl docs failed", e);
      }
    }
    toast.success(
      titleApplied
        ? `タイトル + ${ordered.length} セクション + カテゴリ + 有報リンクでエディタを更新しました`
        : `${ordered.length} セクション + カテゴリ + 有報リンクでエディタを更新しました`
    );
    setConfirmingApply(false);
    onClose();
    onAfterApply?.();
  };

  const handleAppendAll = () => {
    const ordered = SALARY_SECTIONS.filter(
      (s) => runtime[s.id]?.status === "done" && runtime[s.id]?.html
    );
    if (ordered.length === 0) {
      toast.error("生成済みのセクションがありません");
      return;
    }
    const html = ordered.map((s) => runtime[s.id]?.html ?? "").join("\n\n");
    onInsert(`\n${html}\n`);
    toast.success(`${ordered.length} セクションを末尾に追記しました`);
    onClose();
  };

  const toggleExpanded = (id: string) =>
    setExpanded((p) => ({ ...p, [id]: !p[id] }));

  if (!open || !mountedDom) return null;

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (batchRunning) return;
        onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-border px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-brand-600" />
              {company?.name ? `${company.name} × 年収` : "{社名} × 年収"}　記事を生成
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={batchRunning}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 警告：紐付き企業がない */}
        {!company && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              この記事には関連企業が紐付いていません。先に「関連企業」を 1 社以上追加してください。
            </span>
          </div>
        )}

        {/* 使用する最新有報データの表示 */}
        {company && (
          <DataSourcePanel
            companyName={company.name}
            edinetCode={company.edinet_code}
            loading={dataSourceLoading}
            error={dataSourceError}
            data={dataSource}
          />
        )}

        {/* バッチ進捗バー */}
        {batchProgress && (
          <BatchProgressBar
            progress={batchProgress}
            onDismiss={
              batchProgress.finished
                ? () => setBatchProgress(null)
                : undefined
            }
          />
        )}

        {/* 本体 */}
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {/* タイトル生成パネル（決定論的・コスト 0） */}
          <TitlePanel
            company={company}
            data={titleData}
            loading={titleLoading}
            error={titleError}
            included={includeTitle}
            onToggleInclude={setIncludeTitle}
            onRefetch={refetchTitle}
          />

          {/* 全体ステータス */}
          <div className="grid grid-cols-3 gap-2 rounded-md border border-surface-border bg-surface-muted/40 p-3 text-xs">
            <Stat label="進捗" value={`${stats.done}/${SALARY_SECTIONS.length}`} />
            <Stat label="エラー" value={`${stats.errors}`} />
            <Stat
              label="累計コスト"
              value={
                stats.totalCost > 0
                  ? formatUsd(stats.totalCost)
                  : `~${formatUsd(SALARY_TOTAL_EST_COST_USD)}（推定）`
              }
            />
          </div>

          {/* セクション一覧（フラットな行表示、カード装飾なし） */}
          <ul className="divide-y divide-surface-border">
            {SALARY_SECTIONS.map((s) => {
              const r = runtime[s.id] ?? { status: "idle" as const };
              const isExpanded = expanded[s.id];
              return (
                <li key={s.id}>
                  <div className="flex items-center gap-2 py-2">
                    {/* 折りたたみトグル */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s.id)}
                      className="text-ink-muted hover:text-ink"
                      aria-label={isExpanded ? "折りたたむ" : "展開"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* タイトル */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink">
                          {s.title}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            KIND_TONE[s.kind]
                          )}
                        >
                          {SALARY_KIND_LABEL[s.kind]}
                        </span>
                        {s.member_only && (
                          <span
                            className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                            style={{
                              background:
                                "linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)",
                            }}
                            title={
                              s.member_only === "partial"
                                ? "セクションの一部がメンバー限定（属性情報入力者のみ閲覧可）"
                                : "メンバー限定（属性情報入力者のみ閲覧可）"
                            }
                          >
                            🔒
                            {s.member_only === "partial"
                              ? "一部メンバー限定"
                              : "メンバー限定"}
                          </span>
                        )}
                      </div>
                      {!isExpanded && (
                        <div className="mt-0.5 truncate text-xs text-ink-subtle">
                          {s.description}
                        </div>
                      )}
                    </div>

                    {/* ステータス */}
                    <StatusBadge status={r.status} />

                    {/* アクション */}
                    <div className="flex shrink-0 items-center gap-2.5">
                      {r.status === "done" && (
                        <button
                          type="button"
                          onClick={() => handleInsertOne(s)}
                          title="このセクションだけ末尾に追記"
                          className="inline-flex items-center gap-1.5 rounded-md border border-ink/80 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white"
                        >
                          <Check className="h-3 w-3" />
                          挿入
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleGenerateOne(s)}
                        disabled={
                          batchRunning ||
                          r.status === "generating" ||
                          !company
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border border-ink/80 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-ink"
                        )}
                      >
                        {r.status === "generating" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            生成中
                          </>
                        ) : r.status === "done" ? (
                          <>
                            <RotateCw className="h-3 w-3" />
                            再生成
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            生成
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 展開エリア */}
                  {isExpanded && (
                    <div className="space-y-2 pb-3 pl-6 text-xs">
                      <div className="text-ink-muted">{s.description}</div>
                      {r.error && (
                        <div className="rounded bg-negative-50 p-2 text-negative-700">
                          エラー: {r.error}
                        </div>
                      )}
                      {r.html && (
                        <details>
                          <summary className="cursor-pointer text-ink-muted hover:text-ink">
                            プレビュー
                            {r.cost_usd != null && r.cost_usd > 0 && (
                              <span className="ml-2 text-ink-subtle">
                                ({formatUsd(r.cost_usd)})
                              </span>
                            )}
                          </summary>
                          <div
                            className="mt-2 max-h-60 overflow-y-auto border-t border-surface-border pt-2 text-[12px] text-ink"
                            dangerouslySetInnerHTML={{ __html: r.html }}
                          />
                        </details>
                      )}
                      {!r.html && !r.error && (
                        <div className="text-ink-subtle">
                          まだ生成されていません。「生成」ボタンを押してください。
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* フッター */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-surface-border bg-surface-muted/30 px-6 py-3">
          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={!company || batchRunning}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/80 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-ink"
          >
            {batchRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                順次生成中…
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                全セクション生成
              </>
            )}
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAppendAll}
              disabled={stats.done === 0 || batchRunning}
              className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted disabled:opacity-40"
              title="生成済みセクションをエディタ末尾に追記"
            >
              末尾に追記
            </button>
            <button
              type="button"
              onClick={handleApplyAllRequest}
              disabled={stats.done === 0 || batchRunning}
              className="inline-flex items-center gap-1 rounded-md bg-positive-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-positive-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="エディタ全体を生成済みセクションで上書き"
            >
              <Check className="h-3.5 w-3.5" />
              エディタに反映
            </button>
          </div>
        </div>
      </div>

      {/* 「エディタに反映」確認モーダル（重ね表示） */}
      {confirmingApply && (
        <ConfirmApplyModal
          sectionsCount={
            SALARY_SECTIONS.filter(
              (s) => runtime[s.id]?.status === "done" && runtime[s.id]?.html
            ).length
          }
          willApplyTitle={includeTitle && Boolean(titleData?.title) && Boolean(onApplyTitle)}
          titleSample={titleData?.title ?? null}
          onCancel={() => setConfirmingApply(false)}
          onConfirm={handleApplyAllConfirmed}
        />
      )}
    </div>
  );

  return createPortal(node, document.body);
}

// =====================================================================
// タイトル生成パネル
// =====================================================================

function TitlePanel({
  company,
  data,
  loading,
  error,
  included,
  onToggleInclude,
  onRefetch,
}: {
  company: CompanyChip | null;
  data: SalaryTitleResult | null;
  loading: boolean;
  error: string | null;
  included: boolean;
  onToggleInclude: (v: boolean) => void;
  onRefetch: () => void;
}) {
  const overflow = data ? data.visual_length > 32 : false;
  return (
    <div className="rounded-md border border-surface-border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-positive-50 px-1.5 py-0.5 text-[10px] font-semibold text-positive-700">
            タイトル
          </span>
          <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
            決定論的
          </span>
          <span className="text-xs text-ink-subtle">
            データから SEO 固定パターンで自動生成（コスト 0）
          </span>
        </div>
        <button
          type="button"
          onClick={onRefetch}
          disabled={loading || !company}
          className="inline-flex items-center gap-1 rounded-md border border-ink/80 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-ink"
          title="最新データで再計算"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCw className="h-3 w-3" />
          )}
          再生成
        </button>
      </div>

      <div className="mt-2.5">
        {loading && (
          <div className="text-xs text-ink-subtle">タイトル候補を計算しています…</div>
        )}
        {error && (
          <div className="text-xs text-negative-700">エラー: {error}</div>
        )}
        {!loading && !error && data && (
          <>
            <div className="rounded-md bg-surface-muted/40 px-3 py-2 font-numeric text-[15px] font-semibold leading-relaxed text-ink">
              {data.title}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-ink-subtle">
                <span>
                  パターン: <code className="font-mono text-ink-muted">{data.pattern}</code>
                </span>
                <span>
                  全角換算 {data.visual_length} 字
                  {overflow && <span className="ml-1 text-amber-700">（SERP で末尾切れの可能性）</span>}
                  {data.truncated_name && <span className="ml-1 text-amber-700">（社名短縮）</span>}
                </span>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1 text-ink-muted">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(e) => onToggleInclude(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer"
                />
                反映時にエディタのタイトル欄も上書き
              </label>
            </div>
          </>
        )}
        {!loading && !error && !data && !company && (
          <div className="text-xs text-ink-subtle">
            関連企業が紐付いていないため、タイトルを計算できません。
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 「エディタに反映」確認モーダル
// =====================================================================

function ConfirmApplyModal({
  sectionsCount,
  willApplyTitle,
  titleSample,
  onCancel,
  onConfirm,
}: {
  sectionsCount: number;
  willApplyTitle: boolean;
  titleSample: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // ESC でキャンセル
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 pb-3 pt-6">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertCircle className="h-5 w-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-ink">エディタに反映しますか？</h3>
            <p className="mt-1 text-sm text-ink-muted">
              現在のエディタ本文を、生成済み <strong>{sectionsCount}</strong> セクションで
              <strong>上書き</strong>します。元の本文には戻せません（保存前ならエディタを離れて破棄可）。
            </p>
            {willApplyTitle && titleSample && (
              <div className="mt-3 rounded-md border border-surface-border bg-surface-muted/40 px-3 py-2 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-ink-subtle">タイトルも上書き</div>
                <div className="mt-0.5 font-medium text-ink">{titleSample}</div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-surface-border px-6 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1 rounded-md bg-positive-600 px-4 py-2 text-sm font-semibold text-white hover:bg-positive-700"
            autoFocus
          >
            <Check className="h-4 w-4" />
            反映する
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className="font-numeric text-sm font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

// =====================================================================
// 使用する最新有報データのパネル
// 「いまどの年度の有報をもとに記事を生成するか」を読者に明示する。
// 鮮度（提出日からの経過月数）に応じて緑 / 黄 / 赤 で警告する。
// =====================================================================

function DataSourcePanel({
  companyName,
  edinetCode,
  loading,
  error,
  data,
}: {
  companyName: string;
  edinetCode: string;
  loading: boolean;
  error: string | null;
  data: SalaryDataSourceMeta | null;
}) {
  const FRESHNESS_TONE: Record<SalaryDataSourceMeta["freshness"], string> = {
    fresh: "border-positive-200 bg-positive-50 text-positive-700",
    stale: "border-amber-200 bg-amber-50 text-amber-900",
    very_stale: "border-negative/30 bg-negative-50 text-negative-700",
    unknown: "border-surface-border bg-surface-muted/40 text-ink-muted",
  };
  const FRESHNESS_LABEL: Record<SalaryDataSourceMeta["freshness"], string> = {
    fresh: "最新",
    stale: "やや古い",
    very_stale: "古い（要更新）",
    unknown: "未取得",
  };

  // 提出日 ISO → 日本表記
  const formatDate = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  const tone =
    data?.freshness ?? (loading ? "unknown" : error ? "very_stale" : "unknown");
  const isMissing = !loading && !error && (!data || !data.doc_id);

  return (
    <div className="mx-6 mt-4">
      <div
        className={cn(
          "rounded-md border px-3 py-2.5 text-xs",
          FRESHNESS_TONE[tone]
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            <span>使用する最新の有報データ</span>
          </div>
          {data && data.freshness !== "unknown" && (
            <span className="shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold">
              {FRESHNESS_LABEL[data.freshness]}
              {data.age_months != null && ` ・ ${data.age_months} ヶ月前`}
            </span>
          )}
        </div>

        {loading && (
          <div className="mt-1 flex items-center gap-1.5 text-ink-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>取得中…</span>
          </div>
        )}

        {error && !loading && (
          <div className="mt-1 text-negative-700">取得エラー：{error}</div>
        )}

        {!loading && !error && isMissing && (
          <div className="mt-1">
            <p>
              {companyName} の有報データが未取得です。先に EDINET ETL を回してから生成してください。
            </p>
          </div>
        )}

        {!loading && !error && data && data.doc_id && (
          <div className="mt-1 grid gap-x-3 gap-y-0.5 sm:grid-cols-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider opacity-70">
                対象年度
              </span>
              <div className="font-numeric text-sm font-semibold tabular-nums">
                FY {data.fiscal_year ?? "—"}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider opacity-70">
                書類 ID
              </span>
              <div className="flex items-center gap-1 font-mono text-sm">
                <a
                  href={`https://disclosure2.edinet-fsa.go.jp/WEEK0010.aspx?uji.verb=W1E62071EdinetCodeSearch&uji.bean=ee.bean.W1E62071.EE1E62071Bean&TID=W1E62071&PID=W1E62071&edinetCode=${encodeURIComponent(edinetCode)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
                  title="EDINET で開く"
                >
                  {data.doc_id}
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                </a>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider opacity-70">
                提出日
              </span>
              <div className="font-numeric text-sm font-semibold tabular-nums">
                {formatDate(data.submitted_at)}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && data.doc_id && (
          <div className="mt-2 text-[11px] opacity-80">
            経年データ：{data.history_count} 年分が articles 生成に使用されます
          </div>
        )}
      </div>
    </div>
  );
}

function BatchProgressBar({
  progress,
  onDismiss,
}: {
  progress: {
    completed: number;
    total: number;
    currentLabel: string | null;
    okCount: number;
    failCount: number;
    finished: boolean;
    startedAt: number;
    elapsedSec: number;
    etaSec: number;
    etaUpdatedAt: number;
  };
  onDismiss?: () => void;
}) {
  const pct = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;
  const tone = progress.finished
    ? progress.failCount === 0
      ? "ok"
      : "warn"
    : "running";

  // 残り推定：直近キャリブレーション時点の etaSec から経過秒数を引く。
  // EMA 平滑化された係数で計算済みなので、tick での再計算は単純減算のみ。
  // 表示は 5/15/30 秒刻みにスナップしてチラつきを抑える。
  const remainingLabel = (() => {
    if (progress.finished) return null;
    const remaining = progress.total - progress.completed;
    if (remaining <= 0) return null;
    const sinceCalibrate = (Date.now() - progress.etaUpdatedAt) / 1000;
    const raw = Math.max(0, progress.etaSec - sinceCalibrate);
    if (raw <= 1) return formatEta(0);
    return formatEta(snapEta(raw));
  })();

  return (
    <div
      className={cn(
        "mx-6 mt-4 rounded-md border px-3 py-2.5 text-xs",
        tone === "ok" && "border-positive-200 bg-positive-50 text-positive-700",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "running" && "border-brand-200 bg-brand-50/60 text-brand-700"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {!progress.finished && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {progress.finished && progress.failCount === 0 && (
            <Check className="h-3.5 w-3.5" />
          )}
          {progress.finished && progress.failCount > 0 && (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          <span className="font-semibold">
            {progress.finished
              ? progress.failCount === 0
                ? "全セクションを生成しました"
                : `${progress.okCount}/${progress.total} セクションのみ生成（失敗 ${progress.failCount}）`
              : `生成中: ${progress.currentLabel ?? ""}`}
          </span>
        </div>
        <div className="flex items-center gap-2 font-numeric tabular-nums">
          <span>
            {progress.completed}/{progress.total}（{pct}%）
          </span>
          {!progress.finished && remainingLabel && (
            <span className="text-ink-muted">残り約 {remainingLabel}</span>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded p-0.5 hover:bg-white/40"
              aria-label="進捗を閉じる"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {/* 進捗バー：青グラデ + 走査ハイライトで実行中らしさを演出 */}
      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-white/70">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out",
            tone === "ok" &&
              "batch-bar batch-bar--ok",
            tone === "warn" &&
              "batch-bar batch-bar--warn",
            tone === "running" &&
              "batch-bar batch-bar--running"
          )}
          style={{ width: `${pct}%` }}
        >
          {tone === "running" && (
            <div className="batch-bar__shimmer" />
          )}
        </div>
      </div>
      <style>{`
        .batch-bar { background-size: 200% 100%; }
        .batch-bar--ok {
          background-image: linear-gradient(90deg, #4ade80, #22c55e, #16a34a, #22c55e, #4ade80);
          animation: batchFlow 4s linear infinite;
        }
        .batch-bar--warn {
          background-image: linear-gradient(90deg, #fde047, #f59e0b, #d97706, #f59e0b, #fde047);
          animation: batchFlow 4s linear infinite;
        }
        .batch-bar--running {
          background-image: linear-gradient(90deg, #93c5fd, #3b82f6, #1d4ed8, #3b82f6, #93c5fd);
          animation: batchFlow 2.2s linear infinite;
        }
        .batch-bar__shimmer {
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.55),
            transparent
          );
          animation: batchShimmer 1.6s linear infinite;
        }
        @keyframes batchFlow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes batchShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function formatEta(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s === 0 ? `${m} 分` : `${m} 分 ${s} 秒`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h} 時間` : `${h} 時間 ${mm} 分`;
}

function StatusBadge({ status }: { status: SectionStatus }) {
  const tone =
    status === "done"
      ? "bg-positive-50 text-positive-700"
      : status === "generating"
      ? "bg-brand-50 text-brand-700"
      : status === "error"
      ? "bg-negative-50 text-negative-700"
      : "bg-surface-muted text-ink-muted";
  return (
    <span
      className={cn(
        "inline-flex w-14 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        tone
      )}
    >
      {status === "generating" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
