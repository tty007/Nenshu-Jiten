import { CalendarClock, FileText, Layers } from "lucide-react";

type Props = {
  activeJobs: number;
  articlesThisMonth: number;
  nextDispatchLabel: string | null;
};

export function AgentJobStatsCards({
  activeJobs,
  articlesThisMonth,
  nextDispatchLabel,
}: Props) {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={<Layers className="h-4 w-4" />}
        label="アクティブなジョブ"
        value={String(activeJobs)}
        hint="queued / running の合計"
      />
      <StatCard
        icon={<FileText className="h-4 w-4" />}
        label="今月生成された記事"
        value={String(articlesThisMonth)}
        hint="エージェント経由・暦月JST"
      />
      <StatCard
        icon={<CalendarClock className="h-4 w-4" />}
        label="次の実行予定"
        value={nextDispatchLabel ?? "—"}
        hint={
          nextDispatchLabel
            ? "実行中ジョブの最終ディスパッチ"
            : "アクティブなジョブなし"
        }
      />
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className="text-ink-subtle">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-numeric text-2xl font-bold tabular-nums text-ink">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
