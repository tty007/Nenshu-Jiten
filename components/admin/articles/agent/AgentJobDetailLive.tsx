"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Check,
  ExternalLink,
  Loader2,
  Pause,
  Pencil,
  Play,
  PlayCircle,
  RotateCw,
  X,
} from "lucide-react";
import { AgentJobTaskTable } from "./AgentJobTaskTable";
import {
  cancelAgentJob,
  dispatchAgentJob,
  getAgentJobDetailAction,
  pauseAgentJob,
  resumeAgentJob,
  retryFailedTasks,
  updateAgentJobNotes,
} from "@/lib/admin/articles/agent/actions";
import type {
  AgentJobRow,
  AgentJobStatus,
  AgentTaskRow,
  AgentTaskStatus,
} from "@/lib/admin/articles/agent/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<AgentJobStatus, string> = {
  pending: "起票直後",
  queued: "実行待ち",
  running: "実行中",
  completed: "完了",
  completed_with_errors: "一部失敗",
  cancelled: "キャンセル",
  failed: "失敗",
  paused: "一時停止",
};
const STATUS_TONE: Record<AgentJobStatus, string> = {
  pending: "bg-surface-muted text-ink-muted",
  queued: "bg-amber-50 text-amber-900",
  running: "bg-brand-50 text-brand-700",
  completed: "bg-positive-50 text-positive-600",
  completed_with_errors: "bg-amber-50 text-amber-900",
  cancelled: "bg-surface-muted text-ink-muted",
  failed: "bg-negative-50 text-negative-600",
  paused: "bg-surface-muted text-ink",
};

type Filter = "all" | "failed" | "skipped" | "running";

export function AgentJobDetailLive({
  initialJob,
  initialTasks,
  ghActionsUrl,
}: {
  initialJob: AgentJobRow;
  initialTasks: AgentTaskRow[];
  ghActionsUrl: string | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();

  const isActive = job.status === "queued" || job.status === "running";
  const isPaused = job.status === "paused";

  // ポーリング
  useEffect(() => {
    const intervalMs = isActive ? 5_000 : 30_000;
    let cancelled = false;
    const tick = async () => {
      const r = await getAgentJobDetailAction(job.id);
      if (cancelled) return;
      if (r.ok) {
        setJob(r.data.job);
        setTasks(r.data.tasks);
      }
    };
    const t = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [job.id, isActive]);

  const completedish =
    job.succeeded_count +
    job.skipped_count +
    job.failed_count +
    job.cancelled_count;
  const pct =
    job.total_tasks > 0 ? Math.round((completedish / job.total_tasks) * 100) : 0;
  const hasFailed = job.failed_count > 0;

  const filtered = tasks.filter((t) => {
    if (filter === "all") return true;
    const map: Record<Filter, AgentTaskStatus | null> = {
      all: null,
      failed: "failed",
      skipped: "skipped",
      running: "running",
    };
    return t.status === map[filter];
  });

  const counts: Record<Filter, number> = {
    all: tasks.length,
    failed: tasks.filter((t) => t.status === "failed").length,
    skipped: tasks.filter((t) => t.status === "skipped").length,
    running: tasks.filter((t) => t.status === "running").length,
  };

  const onCancel = () => {
    if (!confirm("このジョブをキャンセルしますか？\n（実行中のタスクは次のチェックポイントで停止します）")) return;
    startTransition(async () => {
      const r = await cancelAgentJob(job.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("キャンセル要求を送信しました");
      router.refresh();
    });
  };

  const onRetry = () => {
    startTransition(async () => {
      const r = await retryFailedTasks(job.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.data.retried} 件を再投入しました`);
      router.refresh();
    });
  };

  const onDispatch = () => {
    startTransition(async () => {
      const r = await dispatchAgentJob(job.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        job.status === "queued"
          ? "実行を開始しました"
          : "ワーカーを再起動しました"
      );
      router.refresh();
    });
  };

  const onPause = () => {
    if (!confirm("このジョブを一時停止しますか？\n（実行中のタスクは現在処理中の記事を完了させてから停止します）")) return;
    startTransition(async () => {
      const r = await pauseAgentJob(job.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("一時停止しました（次のタスク境界で停止）");
      router.refresh();
    });
  };

  const onResume = () => {
    startTransition(async () => {
      const r = await resumeAgentJob(job.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("ジョブを再開しました");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/articles/agent"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" />
          ジョブ一覧へ戻る
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <NotesEditor
              jobId={job.id}
              initialValue={job.notes}
              onSaved={(next) => {
                setJob((j) => ({ ...j, notes: next }));
                router.refresh();
              }}
            />
            <p className="mt-0.5 text-xs text-ink-muted">
              ID: <code className="font-mono">{job.id}</code> ・ 年収テンプレート ・ 作成: {formatDateTime(job.created_at)}
              {job.created_by_email && ` ・ ${job.created_by_email}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasFailed && (
              <button
                type="button"
                onClick={onRetry}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-ink/80 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-ink"
              >
                <RotateCw className="h-3 w-3" />
                失敗のみ再試行
              </button>
            )}
            {isActive && (
              <>
                {job.status === "queued" ? (
                  <button
                    type="button"
                    onClick={onDispatch}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    title="このジョブを今すぐ実行（cron や次の trigger を待たない）"
                  >
                    <Play className="h-3 w-3" />
                    今すぐ実行
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onDispatch}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40"
                    title="ワーカーを手動で再起動（停止しているように見える時用）"
                  >
                    <PlayCircle className="h-3 w-3" />
                    Worker 再起動
                  </button>
                )}
                <button
                  type="button"
                  onClick={onPause}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted disabled:opacity-40"
                  title="このジョブを一時停止し、次の待機ジョブを開始する"
                >
                  <Pause className="h-3 w-3" />
                  一時停止
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-negative bg-white px-3 py-1.5 text-xs font-semibold text-negative-600 transition hover:bg-negative-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Ban className="h-3 w-3" />
                  ジョブをキャンセル
                </button>
              </>
            )}
            {isPaused && (
              <button
                type="button"
                onClick={onResume}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                title="このジョブを再開して queued に戻す"
              >
                <Play className="h-3 w-3" />
                再開
              </button>
            )}
            {ghActionsUrl && (
              <a
                href={ghActionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-muted"
              >
                <ExternalLink className="h-3 w-3" />
                GitHub Actions
              </a>
            )}
          </div>
        </div>
      </div>

      {/* サマリ */}
      <section className="rounded-2xl border border-surface-border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                STATUS_TONE[job.status]
              )}
            >
              {STATUS_LABEL[job.status]}
            </span>
            {pending && (
              <Loader2 className="h-3 w-3 animate-spin text-ink-muted" />
            )}
            <span className="font-numeric tabular-nums text-sm text-ink-muted">
              {completedish.toLocaleString("ja-JP")} / {job.total_tasks.toLocaleString("ja-JP")} 件 ({pct}%)
            </span>
          </div>
          <div className="font-numeric text-xs text-ink-muted">
            {job.started_at && `開始 ${formatDateTime(job.started_at)} ・ `}
            {job.finished_at
              ? `完了 ${formatDateTime(job.finished_at)}`
              : isActive
              ? "進行中"
              : "未開始"}
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              job.status === "running"
                ? "bg-brand-500"
                : job.status === "completed"
                ? "bg-positive"
                : job.status === "completed_with_errors"
                ? "bg-amber-500"
                : job.status === "failed"
                ? "bg-negative"
                : job.status === "paused"
                ? "bg-amber-300"
                : "bg-ink-subtle/40"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="生成" value={job.succeeded_count} tone="positive" />
          <Stat label="スキップ" value={job.skipped_count} tone="muted" />
          <Stat label="失敗" value={job.failed_count} tone="negative" />
          <Stat label="中断" value={job.cancelled_count} tone="muted" />
          <Stat
            label="累計コスト"
            value={`$${Number(job.total_cost_usd).toFixed(4)}`}
            tone="ink"
            isString
          />
        </div>
      </section>

      {/* タスク一覧 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">タスク</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FilterPill
              active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              すべて ({counts.all})
            </FilterPill>
            <FilterPill
              active={filter === "failed"}
              onClick={() => setFilter("failed")}
            >
              失敗のみ ({counts.failed})
            </FilterPill>
            <FilterPill
              active={filter === "skipped"}
              onClick={() => setFilter("skipped")}
            >
              スキップのみ ({counts.skipped})
            </FilterPill>
            <FilterPill
              active={filter === "running"}
              onClick={() => setFilter("running")}
            >
              実行中 ({counts.running})
            </FilterPill>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border bg-surface-muted/40 px-6 py-12 text-center text-sm text-ink-muted">
            該当するタスクがありません
          </div>
        ) : (
          <AgentJobTaskTable tasks={filtered} />
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  isString,
}: {
  label: string;
  value: number | string;
  tone: "positive" | "negative" | "muted" | "ink";
  isString?: boolean;
}) {
  const valueTone =
    tone === "positive"
      ? "text-positive-600"
      : tone === "negative"
      ? "text-negative-600"
      : tone === "muted"
      ? "text-ink-muted"
      : "text-ink";
  return (
    <div className="rounded-md border border-surface-border bg-surface-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={cn(
          "font-numeric text-lg font-semibold tabular-nums",
          valueTone
        )}
      >
        {isString ? value : (value as number).toLocaleString("ja-JP")}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition",
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-surface-border bg-white text-ink-muted hover:border-brand-300 hover:text-brand-700"
      )}
    >
      {children}
    </button>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// =====================================================================
// ラベル（notes）のインラインエディタ。
// 鉛筆アイコンクリックで input に変換、Enter / 確定ボタンで保存、
// Escape / × でキャンセル。空文字は notes=null として保存。
// =====================================================================

function NotesEditor({
  jobId,
  initialValue,
  onSaved,
}: {
  jobId: string;
  initialValue: string | null;
  onSaved: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue ?? "");
  const [saving, startSavingTransition] = useTransition();

  // 親の値が変わったら（再フェッチで notes が更新された等）draft を同期
  useEffect(() => {
    if (!editing) setDraft(initialValue ?? "");
  }, [initialValue, editing]);

  const begin = () => {
    setDraft(initialValue ?? "");
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(initialValue ?? "");
  };
  const save = () => {
    const next = draft.trim().slice(0, 80);
    if ((initialValue ?? "") === next) {
      setEditing(false);
      return;
    }
    startSavingTransition(async () => {
      const r = await updateAgentJobNotes(jobId, next);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("ラベルを更新しました");
      onSaved(next.length === 0 ? null : next);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 80))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          disabled={saving}
          placeholder="ラベル（80字まで）"
          className="w-80 rounded-md border border-brand-500 px-3 py-1.5 text-xl font-bold text-ink ring-1 ring-brand-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          title="保存 (Enter)"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          保存
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-muted disabled:opacity-40"
          title="キャンセル (Esc)"
        >
          <X className="h-3 w-3" />
          キャンセル
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h1
        className={cn(
          "text-xl font-bold",
          initialValue ? "text-ink" : "text-ink-subtle"
        )}
      >
        {initialValue ?? "（ラベルなし）"}
      </h1>
      <button
        type="button"
        onClick={begin}
        className="rounded-md p-1 text-ink-subtle opacity-0 transition group-hover:opacity-100 hover:bg-surface-muted hover:text-ink"
        title="ラベルを編集"
        aria-label="ラベルを編集"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
