import Link from "next/link";
import { AlertCircle, Bot, Check, MinusCircle, X } from "lucide-react";
import type {
  AgentJobRow,
  AgentJobStatus,
} from "@/lib/admin/articles/agent/types";
import { cn } from "@/lib/utils";

type Props = {
  jobs: AgentJobRow[];
};

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
  completed: "bg-positive-50 text-positive-700",
  completed_with_errors: "bg-amber-50 text-amber-900",
  cancelled: "bg-surface-muted text-ink-muted",
  failed: "bg-negative-50 text-negative-700",
  paused: "bg-surface-muted text-ink",
};

// グリッドの列定義をヘッダ・行で揃える
const GRID =
  "grid grid-cols-[100px_minmax(0,1fr)_180px_88px_120px_88px] items-center gap-x-4";

export function AgentJobList({ jobs }: Props) {
  return (
    <section className="rounded-2xl border border-surface-border bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-surface-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">ジョブ一覧</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            直近 30 日に作成または公開されたジョブ
          </p>
        </div>
      </header>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Bot className="h-8 w-8 text-ink-subtle" aria-hidden />
          <p className="text-sm font-medium text-ink">まだジョブはありません</p>
          <p className="max-w-sm text-xs text-ink-muted">
            「新しいジョブを作成」からテンプレートと対象企業を指定すると、ここに進捗が表示されます。
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link
                href={`/admin/articles/agent/${j.id}`}
                className={cn(GRID, "px-6 py-3 transition hover:bg-brand-50/30")}
              >
                <JobRow job={j} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobRow({ job }: { job: AgentJobRow }) {
  const completedish =
    job.succeeded_count +
    job.skipped_count +
    job.failed_count +
    job.cancelled_count;
  const pct = job.total_tasks > 0
    ? Math.round((completedish / job.total_tasks) * 100)
    : 0;

  const elapsed = formatElapsed(job.started_at, job.finished_at);

  return (
    <>
      {/* 状態（バッジを 1 行に固定） */}
      <div>
        <span
          className={cn(
            "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
            STATUS_TONE[job.status]
          )}
        >
          {STATUS_LABEL[job.status]}
        </span>
      </div>

      {/* ラベル + メタ */}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">
          {job.notes ?? "（ラベルなし）"}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-ink-subtle">
          年収テンプレート ・ {job.total_tasks.toLocaleString("ja-JP")} 社
          {job.created_by_email && ` ・ ${job.created_by_email}`}
        </div>
      </div>

      {/* 進捗（バー + 内訳を 1 列に縦積み、バーが折り返さない幅を確保済み） */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-ink-muted">
          <span>{pct}%</span>
          <span className="font-numeric tabular-nums text-ink">
            {completedish}/{job.total_tasks}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
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
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
          <Counter
            color="positive"
            icon={<Check className="h-3 w-3" />}
            value={job.succeeded_count}
            title="生成成功"
          />
          <Counter
            color="muted"
            icon={<MinusCircle className="h-3 w-3" />}
            value={job.skipped_count}
            title="スキップ"
          />
          <Counter
            color="negative"
            icon={<AlertCircle className="h-3 w-3" />}
            value={job.failed_count}
            title="失敗"
          />
          {job.cancelled_count > 0 && (
            <Counter
              color="muted"
              icon={<X className="h-3 w-3" />}
              value={job.cancelled_count}
              title="中断"
            />
          )}
        </div>
      </div>

      {/* コスト */}
      <div className="text-right font-numeric text-sm font-semibold tabular-nums text-ink">
        ${Number(job.total_cost_usd).toFixed(4)}
      </div>

      {/* 作成日時 */}
      <div className="font-numeric text-xs tabular-nums text-ink-muted">
        {formatDateTime(job.created_at)}
      </div>

      {/* 経過 */}
      <div className="text-right text-xs text-ink-muted">{elapsed}</div>
    </>
  );
}

function Counter({
  color,
  icon,
  value,
  title,
}: {
  color: "positive" | "negative" | "muted";
  icon: React.ReactNode;
  value: number;
  title: string;
}) {
  const tone =
    color === "positive"
      ? "text-positive-700"
      : color === "negative"
      ? "text-negative-700"
      : "text-ink-muted";
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 font-numeric tabular-nums",
        tone
      )}
    >
      {icon}
      {value}
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // 同年なら「MM/DD HH:mm」、年跨ぎは「YY/MM/DD」
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}/${mm}/${dd}`;
}

function formatElapsed(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return "—";
  }
  const sec = Math.floor((endMs - startMs) / 1000);
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h${mm}m`;
}
