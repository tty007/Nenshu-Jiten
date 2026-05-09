"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, MinusCircle, Repeat, X } from "lucide-react";
import type {
  AgentTaskRow,
  AgentTaskStatus,
} from "@/lib/admin/articles/agent/types";
import { SALARY_SECTIONS } from "@/lib/admin/articles/salary-template/sections";
import { cn } from "@/lib/utils";

type Props = {
  tasks: AgentTaskRow[];
};

const STATUS_LABEL: Record<AgentTaskStatus, string> = {
  pending: "待機",
  running: "実行中",
  succeeded: "生成済",
  skipped: "スキップ",
  failed: "失敗",
  cancelled: "中断",
};

const STATUS_TONE: Record<AgentTaskStatus, string> = {
  pending: "bg-surface-muted text-ink-muted",
  running: "bg-brand-50 text-brand-700",
  succeeded: "bg-positive-50 text-positive-600",
  skipped: "bg-surface-muted text-ink-muted",
  failed: "bg-negative-50 text-negative-600",
  cancelled: "bg-surface-muted text-ink-muted",
};

const SKIP_REASON_LABEL: Record<string, string> = {
  same_yuho: "同一有報",
  same_yuho_at_runtime: "同一有報(実行時)",
  no_metrics: "有報データなし",
  no_salary_data: "平均年収データなし",
  rewrite_disabled: "上書き無効",
  no_newer_yuho: "更新なし",
  cost_cap_reached: "コスト上限",
};

// =====================================================================
// 列幅（ドラッグでリサイズ可能）。企業名列のみ「残り幅を吸収」する flex 列
// にしたいので明示的に与えず、他の列は固定幅で持つ。
// 設定は localStorage に保存して、ページ間 / リロードで保持する。
// =====================================================================

type ColKey =
  | "num"
  | "company"
  | "fy"
  | "status"
  | "progress"
  | "cost"
  | "article"
  | "note";

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  num: 52,
  company: 320,
  fy: 80,
  status: 96,
  progress: 80,
  cost: 92,
  article: 120,
  note: 240,
};
const MIN_WIDTH = 48;
const MAX_WIDTH = 1200;
// 列幅の保存キー。v3 で企業列もリサイズ可能にしたため旧版を無効化。
const STORAGE_KEY = "admin-agent-task-table-col-widths-v3";

export function AgentJobTaskTable({ tasks }: Props) {
  const [widths, setWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS);
  const [resizingKey, setResizingKey] = useState<ColKey | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<ColKey, number>>;
        setWidths((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {
      /* noop */
    }
  }, [widths]);

  const startResize = (key: ColKey) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[key];
    setResizingKey(key);
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + delta));
      setWidths((prev) => ({ ...prev, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setResizingKey(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // 全列の合計幅。table の width にそのまま指定する（w-full は使わない）。
  // 合計 > コンテナ幅なら外側 div で横スクロール、合計 < コンテナ幅でも
  // 各列は意図した幅で表示される（残りは右側の余白）。
  const totalWidth = Object.values(widths).reduce((sum, w) => sum + w, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-white">
      <div className="overflow-x-auto">
        <table
          className="table-fixed text-sm"
          style={{ width: totalWidth }}
        >
          <colgroup>
            <col style={{ width: widths.num }} />
            <col style={{ width: widths.company }} />
            <col style={{ width: widths.fy }} />
            <col style={{ width: widths.status }} />
            <col style={{ width: widths.progress }} />
            <col style={{ width: widths.cost }} />
            <col style={{ width: widths.article }} />
            <col style={{ width: widths.note }} />
          </colgroup>
          <thead className="bg-surface-muted/40 text-xs text-ink-muted">
            <tr>
              <Th onResize={startResize("num")} resizing={resizingKey === "num"}>
                #
              </Th>
              <Th
                onResize={startResize("company")}
                resizing={resizingKey === "company"}
              >
                企業
              </Th>
              <Th onResize={startResize("fy")} resizing={resizingKey === "fy"}>
                対象FY
              </Th>
              <Th onResize={startResize("status")} resizing={resizingKey === "status"}>
                状態
              </Th>
              <Th onResize={startResize("progress")} resizing={resizingKey === "progress"}>
                進捗
              </Th>
              <Th onResize={startResize("cost")} resizing={resizingKey === "cost"}>
                コスト
              </Th>
              <Th onResize={startResize("article")} resizing={resizingKey === "article"}>
                記事
              </Th>
              <Th onResize={startResize("note")} resizing={resizingKey === "note"}>
                備考
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-brand-50/20">
                <Td className="font-numeric tabular-nums text-ink-subtle">
                  {t.sequence + 1}
                </Td>
                <Td align="left">
                  <div
                    className="truncate font-medium text-ink"
                    title={t.company_name}
                  >
                    {t.company_name}
                  </div>
                  <div className="truncate text-[11px] text-ink-subtle">
                    {t.edinet_code}
                  </div>
                </Td>
                <Td className="font-numeric tabular-nums text-ink-muted">
                  {t.target_fiscal_year ? `FY${t.target_fiscal_year}` : "—"}
                </Td>
                <Td>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      STATUS_TONE[t.status]
                    )}
                  >
                    {iconFor(t.status)}
                    {STATUS_LABEL[t.status]}
                  </span>
                  {t.was_rewrite && t.status === "succeeded" && (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      <Repeat className="h-2.5 w-2.5" />
                      上書き
                    </span>
                  )}
                </Td>
                <Td>
                  {t.status === "running" ? (
                    <div>
                      <div className="font-numeric tabular-nums text-ink-muted">
                        {t.sections_done}/{t.sections_total}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[10px] text-brand-700"
                        title={currentSectionDescription(t)}
                      >
                        {currentSectionLabel(t)}
                      </div>
                    </div>
                  ) : t.status === "succeeded" ? (
                    <span className="font-numeric tabular-nums text-ink-muted">
                      {t.sections_done}/{t.sections_total}
                    </span>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </Td>
                <Td className="font-numeric tabular-nums">
                  {t.cost_usd > 0 ? `$${t.cost_usd.toFixed(4)}` : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </Td>
                <Td>
                  {t.article_id ? (
                    <Link
                      href={`/admin/articles/${t.article_id}`}
                      className="text-brand-700 underline-offset-2 hover:underline"
                    >
                      記事を開く
                    </Link>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </Td>
                <Td align="left" className="text-ink-muted">
                  {t.error_message ? (
                    <NoteCell tone="negative" title={t.error_message}>
                      {t.error_message}
                    </NoteCell>
                  ) : t.skip_reason ? (
                    <NoteCell title={t.skip_reason}>
                      {SKIP_REASON_LABEL[t.skip_reason] ?? t.skip_reason}
                    </NoteCell>
                  ) : t.attempts > 1 ? (
                    <NoteCell>再試行 {t.attempts} 回</NoteCell>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * テーブルヘッダ。
 * - テキスト中央揃え
 * - 列の右側に区切り線（border-r）。最終列だけ消す
 * - 右端 4px の不可視リサイズハンドルを配置（onResize 指定時のみ）
 */
function Th({
  children,
  className,
  onResize,
  resizing,
}: {
  children: React.ReactNode;
  className?: string;
  onResize?: (e: React.MouseEvent) => void;
  resizing?: boolean;
}) {
  return (
    <th
      className={cn(
        "relative select-none border-r border-surface-border px-3 py-2 text-center font-semibold uppercase tracking-wider last:border-r-0",
        className
      )}
    >
      {children}
      {onResize && (
        <span
          onMouseDown={onResize}
          className={cn(
            // 列右端の縦バー。普段は透明、ホバーで brand 色、ドラッグ中はずっと色付き
            "absolute right-0 top-1/2 z-10 h-5 w-1 -translate-y-1/2 cursor-col-resize",
            "bg-transparent transition hover:bg-brand-500/60",
            resizing && "bg-brand-500"
          )}
          aria-hidden
        />
      )}
    </th>
  );
}

function Td({
  children,
  className,
  align = "center",
}: {
  children: React.ReactNode;
  className?: string;
  /** 水平方向の揃え。企業/備考のように左寄せにしたい列は "left" を指定 */
  align?: "center" | "left";
}) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle",
        align === "left" ? "text-left" : "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}

/**
 * 備考セルの 1 行表示。テキストが長い場合は内部だけ横スクロール。
 * 列幅を超えるテキストはスクロールバーで全文確認できる。
 * ホバー時の title 属性で全文をツールチップ表示。
 */
function NoteCell({
  children,
  title,
  tone,
}: {
  children: React.ReactNode;
  title?: string;
  tone?: "negative";
}) {
  return (
    <div
      title={title}
      className={cn(
        "max-w-full overflow-x-auto whitespace-nowrap pr-1",
        "[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-ink-subtle/40 [&::-webkit-scrollbar-thumb]:rounded",
        tone === "negative" ? "text-negative-600" : ""
      )}
    >
      {children}
    </div>
  );
}

function iconFor(status: AgentTaskStatus) {
  if (status === "running") return <Loader2 className="h-2.5 w-2.5 animate-spin" />;
  if (status === "succeeded") return <Check className="h-2.5 w-2.5" />;
  if (status === "failed") return <AlertCircle className="h-2.5 w-2.5" />;
  if (status === "skipped") return <MinusCircle className="h-2.5 w-2.5" />;
  if (status === "cancelled") return <X className="h-2.5 w-2.5" />;
  return null;
}

/**
 * sections_done から「いま処理中（or 直後にスタートする）セクション」を割り出して
 * 短いラベルで表示する。
 *   sections_done = N → 既に N 個完了済み → 次に処理するのは N 番目（zero-indexed）
 *   sections_done >= total → 全セクション生成済み → 本文保存中
 */
function currentSectionLabel(t: AgentTaskRow): string {
  if (t.sections_done >= t.sections_total) return "本文を保存中…";
  const sec = SALARY_SECTIONS[t.sections_done];
  if (!sec) return "";
  return `§${sec.id} ${sec.title} を生成中`;
}

function currentSectionDescription(t: AgentTaskRow): string {
  if (t.sections_done >= t.sections_total) return "本文を保存しています";
  const sec = SALARY_SECTIONS[t.sections_done];
  if (!sec) return "";
  return `§${sec.id} ${sec.title} ─ ${sec.description}`;
}
