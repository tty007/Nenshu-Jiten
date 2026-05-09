"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Coins,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  createAgentJob,
  previewAgentJobScope,
} from "@/lib/admin/articles/agent/actions";
import { searchCompaniesForEditor } from "@/lib/admin/articles/actions";
import type {
  AgentFreshness,
  AgentJobScopePreview,
} from "@/lib/admin/articles/agent/types";
import { SALARY_TOTAL_EST_COST_USD } from "@/lib/admin/articles/salary-template/sections";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SelectionMode = "all_with_freshness" | "individual";

const FRESHNESS_LABEL: Record<AgentFreshness, string> = {
  this_month: "今月",
  last_month: "先月",
  specific_month: "月指定",
  last_3_months: "過去3ヶ月",
  last_6_months: "過去6ヶ月",
  last_12_months: "過去1年",
};

type CompanyChip = {
  id: string;
  edinet_code: string;
  name: string;
  industry_name: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateAgentJobDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [mountedDom, setMountedDom] = useState(false);
  const [selectionMode, setSelectionMode] =
    useState<SelectionMode>("all_with_freshness");
  const [freshness, setFreshness] = useState<AgentFreshness>("this_month");
  const [monthAnchor, setMonthAnchor] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [individualCompanies, setIndividualCompanies] = useState<CompanyChip[]>(
    []
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const [skipExisting, setSkipExisting] = useState(true);
  const [rewriteIfNewer, setRewriteIfNewer] = useState(true);
  const [concurrency, setConcurrency] = useState(1);
  const [costCapEnabled, setCostCapEnabled] = useState(false);
  const [costCapUsd, setCostCapUsd] = useState<string>("5");
  const [notes, setNotes] = useState<string>("");
  const [optionsOpen, setOptionsOpen] = useState(true);

  const [confirming, setConfirming] = useState(false);

  // プレビュー
  const [preview, setPreview] = useState<AgentJobScopePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // 送信
  const [submitting, startSubmitTransition] = useTransition();

  useEffect(() => {
    setMountedDom(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, submitting, onClose]);

  // プレビュー：依存値が変わったら 350ms デバウンスで再取得
  const companyIdsKey = useMemo(
    () => individualCompanies.map((c) => c.id).sort().join(","),
    [individualCompanies]
  );

  useEffect(() => {
    if (!open) return;
    // 個別モードで未選択なら何もしない
    if (selectionMode === "individual" && individualCompanies.length === 0) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    const t = window.setTimeout(async () => {
      const r = await previewAgentJobScope({
        selectionMode,
        freshness:
          selectionMode === "all_with_freshness" ? freshness : null,
        monthAnchor:
          selectionMode === "all_with_freshness" &&
          freshness === "specific_month"
            ? monthAnchor
            : null,
        companyIds:
          selectionMode === "individual"
            ? individualCompanies.map((c) => c.id)
            : [],
        options: {
          skipExisting,
          rewriteIfNewerYuho: rewriteIfNewer,
          concurrency,
        },
      });
      if (cancelled) return;
      setPreviewLoading(false);
      if (r.ok) setPreview(r.data);
      else setPreviewError(r.error);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [
    open,
    selectionMode,
    freshness,
    monthAnchor,
    companyIdsKey,
    individualCompanies.length,
    skipExisting,
    rewriteIfNewer,
    concurrency,
  ]);

  const willActuallyRun = preview
    ? skipExisting
      ? preview.wouldCreate + preview.wouldRewrite
      : preview.totalSelected
    : 0;

  const submitDisabled =
    submitting || !preview || willActuallyRun === 0;

  const heavy = preview
    ? preview.estimatedCostUsd > 5 || preview.totalSelected > 300
    : false;

  if (!open || !mountedDom) return null;

  const doSubmit = () => {
    startSubmitTransition(async () => {
      const r = await createAgentJob({
        selectionMode,
        freshness:
          selectionMode === "all_with_freshness" ? freshness : null,
        monthAnchor:
          selectionMode === "all_with_freshness" &&
          freshness === "specific_month"
            ? monthAnchor
            : null,
        companyIds:
          selectionMode === "individual"
            ? individualCompanies.map((c) => c.id)
            : [],
        options: {
          skipExisting,
          rewriteIfNewerYuho: rewriteIfNewer,
          concurrency,
          costCapUsd: costCapEnabled ? Number(costCapUsd) : null,
        },
        notes: notes.trim() || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("ジョブを追加しました");
      onClose();
      router.push(`/admin/articles/agent/${r.data.jobId}`);
      router.refresh();
    });
  };

  const handleSubmit = () => {
    if (heavy && !confirming) {
      setConfirming(true);
      return;
    }
    doSubmit();
  };

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-border px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Sparkles className="h-4 w-4 text-brand-600" />
            新しいジョブを作成
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* テンプレ選択 */}
          <section>
            <SectionTitle>1. テンプレートを選択</SectionTitle>
            <div className="mt-2">
              <TemplateRadio
                checked
                title="年収テンプレート"
                description="EDINET 有報の経年データから年収記事を生成。15 セクション、約 $0.0074/社"
                onChange={() => {}}
              />
            </div>
          </section>

          {/* 対象選択 */}
          <section>
            <SectionTitle>2. 対象企業を指定</SectionTitle>
            <div className="mt-2 inline-flex rounded-md border border-surface-border bg-surface-muted/40 p-0.5 text-xs">
              <ModeTab
                active={selectionMode === "all_with_freshness"}
                onClick={() => setSelectionMode("all_with_freshness")}
              >
                全社
              </ModeTab>
              <ModeTab
                active={selectionMode === "individual"}
                onClick={() => setSelectionMode("individual")}
              >
                個別検索
              </ModeTab>
            </div>

            {selectionMode === "all_with_freshness" ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-ink-muted">
                  最新の有価証券報告書の<strong>提出日</strong>がウィンドウ内にある企業を対象にします。
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "this_month",
                      "last_month",
                      "specific_month",
                      "last_3_months",
                      "last_6_months",
                      "last_12_months",
                    ] as const
                  ).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFreshness(k)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        freshness === k
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-surface-border bg-white text-ink-muted hover:border-brand-300 hover:text-brand-700"
                      )}
                    >
                      {FRESHNESS_LABEL[k]}
                    </button>
                  ))}
                </div>
                {freshness === "specific_month" && (
                  <div className="flex items-center gap-2 text-xs">
                    <label className="text-ink-muted">対象月:</label>
                    <input
                      type="month"
                      value={monthAnchor}
                      onChange={(e) => setMonthAnchor(e.target.value)}
                      className="rounded-md border border-surface-border px-2 py-1 font-numeric tabular-nums focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-ink-muted">
                  個別に企業を選んで対象にします。500 社を超えると警告します。
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {individualCompanies.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white py-1 pl-3 pr-1 text-sm text-ink"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-ink-subtle">
                        {c.edinet_code}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setIndividualCompanies((prev) =>
                            prev.filter((p) => p.id !== c.id)
                          )
                        }
                        className="rounded-full p-1 text-ink-muted hover:bg-negative-50 hover:text-negative-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-border bg-white px-3 py-1 text-sm text-ink-muted hover:border-brand-300 hover:text-brand-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    企業を追加
                  </button>
                </div>
                {individualCompanies.length > 500 && (
                  <p className="text-xs text-amber-700">
                    500 社を超えました。実行に時間がかかります。
                  </p>
                )}
              </div>
            )}
          </section>

          {/* プレビュー */}
          <section className="rounded-lg border border-surface-border bg-surface-muted/30 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">対象プレビュー</h3>
              <span className="text-[11px] text-ink-subtle">
                追加時の状態で確定（実行時に再判定）
              </span>
            </div>
            {previewLoading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                対象を集計中…
              </div>
            )}
            {previewError && !previewLoading && (
              <div className="mt-2 rounded bg-negative-50 px-2 py-1.5 text-xs text-negative-600">
                {previewError}
              </div>
            )}
            {!previewLoading && !previewError && preview && (
              <div className="mt-2 grid gap-3 sm:grid-cols-4">
                <PreviewStat label="対象社数" value={preview.totalSelected} />
                <PreviewStat
                  label="新規生成"
                  value={preview.wouldCreate}
                  tone="positive"
                />
                <PreviewStat
                  label="再生成（上書き）"
                  value={preview.wouldRewrite}
                  tone="brand"
                />
                <PreviewStat
                  label="スキップ"
                  value={preview.wouldSkip}
                  tone="muted"
                />
              </div>
            )}
            {!previewLoading && !previewError && !preview && (
              <p className="mt-1 text-xs text-ink-muted">
                {selectionMode === "individual"
                  ? "企業を 1 社以上追加してください。"
                  : "鮮度フィルタを選択してください。"}
              </p>
            )}
            {!previewLoading && !previewError && preview && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-surface-border pt-3 text-xs">
                <div className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Coins className="h-3.5 w-3.5" />
                  推定コスト{" "}
                  <span className="font-numeric tabular-nums font-semibold text-ink">
                    ${preview.estimatedCostUsd.toFixed(4)}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Clock className="h-3.5 w-3.5" />
                  推定実行時間{" "}
                  <span className="font-numeric tabular-nums font-semibold text-ink">
                    {formatRuntime(preview.estimatedRuntimeMinutes)}
                  </span>
                </div>
                {heavy && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-amber-900">
                    <AlertTriangle className="h-3 w-3" />
                    大規模ジョブ：実行前に確認します
                  </div>
                )}
              </div>
            )}
          </section>

          {/* オプション */}
          <section className="rounded-lg border border-surface-border bg-white">
            <button
              type="button"
              onClick={() => setOptionsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-muted/40"
            >
              <span>3. オプション</span>
              <span className="text-xs text-ink-muted">
                {optionsOpen ? "閉じる" : "開く"}
              </span>
            </button>
            {optionsOpen && (
              <div className="space-y-3 border-t border-surface-border px-4 py-3 text-sm">
                <Toggle
                  checked={skipExisting}
                  onChange={setSkipExisting}
                  label="同一有報の既存記事はスキップ"
                  hint="記事生成済みかつ最新有報の doc_id と一致する企業を対象から外します（実行時にも再評価）"
                />
                <Toggle
                  checked={rewriteIfNewer}
                  onChange={setRewriteIfNewer}
                  label="新しい有報がある場合は再生成して上書き"
                  hint="既存の本文・タイトルは置き換わります（手動編集の有無は確認しません）"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs text-ink-muted">並列度</label>
                  <ConcurrencyDropdown
                    value={concurrency}
                    onChange={setConcurrency}
                  />
                  <span className="text-[11px] text-ink-subtle">
                    OpenAI のレート制限に余裕を持たせるため、まずは 1 を推奨
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={costCapEnabled}
                      onChange={(e) => setCostCapEnabled(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    コスト上限を設定
                  </label>
                  <div className="inline-flex items-center gap-1 text-sm">
                    <span className="text-ink-subtle">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costCapUsd}
                      onChange={(e) => setCostCapUsd(e.target.value)}
                      disabled={!costCapEnabled}
                      className="w-20 rounded-md border border-surface-border px-2 py-1 font-numeric tabular-nums focus:border-brand-500 focus:outline-none disabled:bg-surface-muted/40 disabled:text-ink-subtle"
                    />
                    <span className="text-[11px] text-ink-subtle">
                      上限到達で残タスクを中断
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-ink-muted">
                    ラベル（任意・80字まで）
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 80))}
                    placeholder="例: 年収・全社・5月分"
                    className="mt-1 w-full rounded-md border border-surface-border px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-surface-border bg-surface-muted/30 px-6 py-3">
          <div className="text-xs text-ink-muted">
            {preview ? (
              <>
                <span className="font-numeric tabular-nums font-semibold text-ink">
                  {willActuallyRun.toLocaleString("ja-JP")}
                </span>{" "}
                社を処理 ・ 推定{" "}
                <span className="font-numeric tabular-nums">
                  ${preview.estimatedCostUsd.toFixed(4)}
                </span>
              </>
            ) : (
              "対象を指定してください"
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-40"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  追加中…
                </>
              ) : heavy ? (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  確認して追加
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  ジョブを追加
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <CompanyPicker
          excludeIds={new Set(individualCompanies.map((c) => c.id))}
          onPick={(c) =>
            setIndividualCompanies((prev) =>
              prev.find((p) => p.id === c.id) ? prev : [...prev, c]
            )
          }
          onClose={() => setPickerOpen(false)}
        />
      )}

      {confirming && preview && (
        <ConfirmHeavyJobModal
          totalSelected={preview.totalSelected}
          willActuallyRun={willActuallyRun}
          estimatedCostUsd={preview.estimatedCostUsd}
          estimatedRuntimeMinutes={preview.estimatedRuntimeMinutes}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            doSubmit();
          }}
        />
      )}
    </div>
  );

  return createPortal(node, document.body);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-ink">{children}</h3>;
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-3 py-1.5 font-medium transition",
        active
          ? "bg-white text-ink shadow-sm"
          : "text-ink-muted hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

function TemplateRadio({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex items-start gap-2.5 rounded-md border bg-white px-3 py-2.5 text-left transition",
        checked
          ? "border-brand-600 ring-1 ring-brand-600"
          : "border-surface-border hover:border-brand-300"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          checked
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-surface-border bg-white"
        )}
      >
        {checked && <Check className="h-2.5 w-2.5" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-xs text-ink-muted">{description}</div>
      </div>
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer"
      />
      <span>
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint && (
          <span className="block text-[11px] text-ink-muted">{hint}</span>
        )}
      </span>
    </label>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "brand" | "muted";
}) {
  const valueTone =
    tone === "positive"
      ? "text-positive-600"
      : tone === "brand"
      ? "text-brand-700"
      : tone === "muted"
      ? "text-ink-muted"
      : "text-ink";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={cn(
          "font-numeric text-lg font-semibold tabular-nums",
          valueTone
        )}
      >
        {value.toLocaleString("ja-JP")}
      </div>
    </div>
  );
}

// =====================================================================
// 並列度ドロップダウン
// =====================================================================

const CONCURRENCY_OPTIONS: Array<{
  value: number;
  label: string;
  hint: string;
}> = [
  { value: 1, label: "1", hint: "推奨：レート制限に最も余裕" },
  { value: 2, label: "2", hint: "やや高速・通常は問題なし" },
  { value: 3, label: "3", hint: "最速・OpenAI の Tier に注意" },
];

function ConcurrencyDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected =
    CONCURRENCY_OPTIONS.find((o) => o.value === value) ??
    CONCURRENCY_OPTIONS[0];

  return (
    <div ref={ref} className="relative inline-block text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm transition hover:bg-surface-muted/50",
          open
            ? "border-brand-500 ring-1 ring-brand-500"
            : "border-surface-border"
        )}
      >
        <span className="font-numeric tabular-nums font-semibold text-ink">
          {selected.label}
        </span>
        {selected.value === 1 && (
          <span className="rounded-full bg-positive-50 px-1.5 py-0.5 text-[10px] font-semibold text-positive-600">
            推奨
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-ink-subtle transition",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-surface-border bg-white shadow-lg"
        >
          <ul className="py-1">
            {CONCURRENCY_OPTIONS.map((o) => {
              const isSelected = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-brand-50/40",
                      isSelected && "bg-brand-50/60"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-surface-border bg-white"
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="font-numeric tabular-nums text-sm font-semibold text-ink">
                          {o.label}
                        </span>
                        {o.value === 1 && (
                          <span className="rounded-full bg-positive-50 px-1.5 py-0.5 text-[10px] font-semibold text-positive-600">
                            推奨
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        {o.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} 時間` : `${h} 時間 ${m} 分`;
}

// =====================================================================
// 企業ピッカー（実検索）
// =====================================================================

function CompanyPicker({
  excludeIds,
  onPick,
  onClose,
}: {
  excludeIds: Set<string>;
  onPick: (c: CompanyChip) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const r = await searchCompaniesForEditor(q);
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        setResults([]);
        return;
      }
      setResults(
        r.data.map((c) => ({
          id: c.id,
          edinet_code: c.edinet_code,
          name: c.name,
          industry_name: c.industry_name,
        }))
      );
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <Search className="h-4 w-4 text-ink-subtle" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="社名・カナ・EDINET・証券コードで検索"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-ink-subtle"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {!query.trim() && (
            <p className="px-4 py-6 text-center text-sm text-ink-subtle">
              キーワードを入力してください
            </p>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              検索中…
            </div>
          )}
          {error && (
            <p className="px-4 py-3 text-sm text-negative-600">{error}</p>
          )}
          {!loading && query.trim() && !error && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">
              該当企業がありません
            </p>
          )}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-surface-border">
              {results.map((r) => {
                const already = excludeIds.has(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => {
                        onPick(r);
                        onClose();
                      }}
                      className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:bg-surface-muted/30 disabled:hover:bg-surface-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-ink">{r.name}</div>
                        <div className="text-xs text-ink-muted">
                          {r.edinet_code}
                          {r.industry_name && ` / ${r.industry_name}`}
                        </div>
                      </div>
                      {already && (
                        <span className="shrink-0 text-xs text-ink-subtle">
                          追加済み
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 大規模ジョブの確認モーダル
// =====================================================================

function ConfirmHeavyJobModal({
  totalSelected,
  willActuallyRun,
  estimatedCostUsd,
  estimatedRuntimeMinutes,
  onCancel,
  onConfirm,
}: {
  totalSelected: number;
  willActuallyRun: number;
  estimatedCostUsd: number;
  estimatedRuntimeMinutes: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 pb-3 pt-6">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-ink">
              大規模ジョブを追加しますか？
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              対象 <strong>{totalSelected.toLocaleString("ja-JP")}</strong> 社のうち、
              実際に処理されるのは <strong>{willActuallyRun.toLocaleString("ja-JP")}</strong> 社です。
              GitHub Actions が必要に応じて自動で再ディスパッチを繰り返し、最後まで処理します。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-surface-border bg-surface-muted/40 px-3 py-2 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
                  推定コスト
                </div>
                <div className="font-numeric text-sm font-semibold tabular-nums text-ink">
                  ${estimatedCostUsd.toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
                  推定実行時間
                </div>
                <div className="font-numeric text-sm font-semibold tabular-nums text-ink">
                  {formatRuntime(estimatedRuntimeMinutes)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-surface-border px-6 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" />
            追加する
          </button>
        </div>
      </div>
    </div>
  );
}
