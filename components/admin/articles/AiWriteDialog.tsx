"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  RotateCw,
  Check,
} from "lucide-react";
import {
  AI_MODELS,
  DETAIL_LEVELS,
  estimateCostUsd,
  estimateTokens,
  formatUsd,
  type AiModelId,
  type DetailLevel,
} from "@/lib/admin/articles/ai-write-prompt";
import { generateArticleDraft } from "@/lib/admin/articles/ai-write-actions";
import { dismissToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type AiWriteDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 紐付き企業数（コスト推定用） */
  companyCount: number;
  /** 対象記事の ID */
  articleId: string;
  /** 生成完了で挿入するための callback */
  onInsert: (html: string) => void;
};

const MIN_CHARS = 200;
const MAX_CHARS = 5000;
const STEP_CHARS = 100;

export function AiWriteDialog({
  open,
  onClose,
  companyCount,
  articleId,
  onInsert,
}: AiWriteDialogProps) {
  const [mountedDom, setMountedDom] = useState(false);
  const [model, setModel] = useState<AiModelId>("gpt-4o-mini");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");
  const [userInstruction, setUserInstruction] = useState("");
  const [supplementalMemo, setSupplementalMemo] = useState("");
  const [targetChars, setTargetChars] = useState(1200);
  const [resultHtml, setResultHtml] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMountedDom(true);
  }, []);

  // open 切替で state を一部リセット（モデル設定等は維持）
  useEffect(() => {
    if (open) {
      setResultHtml(null);
    }
  }, [open]);

  // ESC で閉じる（生成中は無効）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isPending, onClose]);

  // リアルタイムコスト推定
  const tokens = useMemo(
    () =>
      estimateTokens({
        detailLevel,
        companyCount,
        userInstructionChars: userInstruction.length,
        supplementalMemoChars: supplementalMemo.length,
        targetChars,
      }),
    [detailLevel, companyCount, userInstruction.length, supplementalMemo.length, targetChars]
  );

  const costUsd = useMemo(
    () =>
      estimateCostUsd({
        model,
        inputTokens: tokens.input,
        outputTokens: tokens.output,
      }),
    [model, tokens.input, tokens.output]
  );

  const canGenerate =
    !isPending && companyCount > 0 && AI_MODELS[model].available;

  const handleGenerate = () => {
    if (!canGenerate) return;
    setResultHtml(null);
    const loadingId = toast.loading("AI が執筆中…（10〜30 秒）");
    startTransition(async () => {
      const res = await generateArticleDraft({
        articleId,
        model,
        detailLevel,
        userInstruction,
        supplementalMemo,
        targetChars,
      });
      dismissToast(loadingId);
      if (!res.ok) {
        toast.error(`生成に失敗しました: ${res.error}`);
        return;
      }
      setResultHtml(res.data.html);
      toast.success(
        `生成しました（実コスト ${formatUsd(res.data.usage.cost_usd)}）`
      );
    });
  };

  const handleInsert = () => {
    if (!resultHtml) return;
    onInsert(resultHtml);
    onClose();
    toast.success("本文に挿入しました");
  };

  const handleRetry = () => {
    setResultHtml(null);
  };

  if (!open || !mountedDom) return null;

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (isPending) return;
        onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー（固定高） */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-border px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Sparkles className="h-4 w-4 text-brand-600" />
            AI 執筆
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 本体（残り高さを埋めて内部スクロール） */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {companyCount === 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                この記事には関連企業が紐付いていません。先に「関連企業」を 1 社以上追加してください。
              </span>
            </div>
          ) : null}

          {/* 結果プレビューが出ているときは入力 UI を畳む */}
          {resultHtml === null ? (
            <>
              {/* AI モデル */}
              <Section title="AI モデル">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(AI_MODELS) as AiModelId[]).map((id) => {
                    const m = AI_MODELS[id];
                    const selected = model === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => m.available && setModel(id)}
                        disabled={!m.available || isPending}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition",
                          selected && m.available
                            ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                            : "border-surface-border bg-white hover:border-surface-border",
                          !m.available && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <div className="flex w-full items-center justify-between text-sm font-medium text-ink">
                          <span>{m.label}</span>
                          {!m.available && (
                            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-subtle">
                              準備中
                            </span>
                          )}
                        </div>
                        <div className="font-numeric text-xs tabular-nums text-ink-muted">
                          ${m.input_per_1m}/1M in ・ ${m.output_per_1m}/1M out
                        </div>
                        {m.notes && (
                          <div className="text-xs text-ink-subtle">{m.notes}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* 指示 */}
              <Section title="書いて欲しい内容">
                <textarea
                  value={userInstruction}
                  onChange={(e) => setUserInstruction(e.target.value)}
                  rows={3}
                  disabled={isPending}
                  placeholder="例：トヨタとホンダの年収を比較して、自動車業界の文脈で読み解いて"
                  className="w-full resize-y rounded-md border border-surface-border bg-white p-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
                />
                <div className="mt-1 text-right text-xs text-ink-subtle">
                  {userInstruction.length} 字
                </div>
              </Section>

              {/* 詳細度 */}
              <Section title="企業データの詳細度">
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(DETAIL_LEVELS) as DetailLevel[]).map((lvl) => {
                    const d = DETAIL_LEVELS[lvl];
                    const selected = detailLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDetailLevel(lvl)}
                        disabled={isPending}
                        className={cn(
                          "rounded-md border p-3 text-left transition",
                          selected
                            ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                            : "border-surface-border bg-white hover:border-surface-border",
                          isPending && "opacity-60"
                        )}
                      >
                        <div className="text-sm font-medium text-ink">{d.label}</div>
                        <div className="mt-0.5 text-xs text-ink-muted">
                          {d.description}
                        </div>
                        <div className="mt-1 font-numeric text-[10px] tabular-nums text-ink-subtle">
                          ~{d.tokens_per_company} tok/社
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* 補足メモ */}
              <Section
                title="補足メモ（任意）"
                hint="ニュース・記事 URL の要約・編集者の参考情報など。AI が文脈づくりに使います"
              >
                <textarea
                  value={supplementalMemo}
                  onChange={(e) => setSupplementalMemo(e.target.value)}
                  rows={3}
                  disabled={isPending}
                  placeholder="例：先月のリコール発表の要約 / 海外進出のニュース要点 など"
                  className="w-full resize-y rounded-md border border-surface-border bg-white p-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
                />
                <div className="mt-1 text-right text-xs text-ink-subtle">
                  {supplementalMemo.length} 字
                </div>
              </Section>

              {/* 希望文字数 */}
              <Section title="希望文字数">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={MIN_CHARS}
                    max={MAX_CHARS}
                    step={STEP_CHARS}
                    value={targetChars}
                    onChange={(e) => setTargetChars(parseInt(e.target.value, 10))}
                    disabled={isPending}
                    className="flex-1 accent-brand-600"
                  />
                  <span className="font-numeric w-20 text-right text-sm font-semibold tabular-nums text-ink">
                    {targetChars.toLocaleString("ja-JP")} 字
                  </span>
                </div>
              </Section>

              {/* コスト推定 */}
              <div className="rounded-md border border-surface-border bg-surface-muted/40 p-3 text-sm">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  推定コスト
                </div>
                <div className="grid grid-cols-2 gap-y-0.5 text-xs text-ink-muted sm:grid-cols-3">
                  <div>
                    入力: <span className="font-numeric tabular-nums text-ink">{tokens.input.toLocaleString("ja-JP")} tok</span>
                  </div>
                  <div>
                    出力: <span className="font-numeric tabular-nums text-ink">~{tokens.output.toLocaleString("ja-JP")} tok</span>
                  </div>
                  <div>
                    合計: <span className="font-numeric font-semibold tabular-nums text-ink">{formatUsd(costUsd)}</span>
                  </div>
                </div>
                {companyCount > 0 && (
                  <div className="mt-1 text-xs text-ink-subtle">
                    紐付き企業: {companyCount} 社 × {DETAIL_LEVELS[detailLevel].label}
                  </div>
                )}
              </div>
            </>
          ) : (
            // 結果プレビュー
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                生成結果プレビュー
              </div>
              <div
                className="prose prose-sm max-h-[40vh] max-w-none overflow-y-auto rounded-md border border-surface-border bg-white p-4 text-sm text-ink"
                dangerouslySetInnerHTML={{ __html: resultHtml }}
              />
              <p className="mt-2 text-xs text-ink-subtle">
                「挿入」を押すとカーソル位置に追加されます。気に入らなければ「やり直す」で再生成できます。
              </p>
            </div>
          )}
        </div>

        {/* フッター（固定高） */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-surface-border bg-surface-muted/30 px-6 py-3">
          {resultHtml === null ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-md border border-surface-border bg-white px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    生成中…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    AI 執筆を実行
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-sm text-ink hover:bg-surface-muted disabled:opacity-40"
              >
                <RotateCw className="h-3.5 w-3.5" />
                やり直す
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-md border border-surface-border bg-white px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleInsert}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md bg-positive-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-positive-700 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                本文に挿入
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </div>
      {hint && <p className="mb-1.5 text-xs text-ink-subtle">{hint}</p>}
      {children}
    </div>
  );
}
