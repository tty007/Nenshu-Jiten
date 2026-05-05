import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "ok";
  /** 値の下に inline で出すトレンドチャート等 */
  trend?: React.ReactNode;
};

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  default: "border-surface-border",
  ok: "border-positive/30 bg-positive-50/40",
  warning: "border-amber-200 bg-amber-50/50",
  danger: "border-negative/30 bg-negative-50/40",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone = "default",
  trend,
}: Props) {
  return (
    <div className={`flex h-full flex-col rounded-2xl border bg-white p-6 sm:p-7 ${TONE[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        {Icon && <Icon className="h-4 w-4 text-brand-600" aria-hidden />}
        {label}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-numeric text-3xl font-bold tabular-nums text-ink">
          {typeof value === "number" ? value.toLocaleString("ja-JP") : value}
        </span>
        {unit && <span className="text-sm text-ink-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
      {trend && <div className="mt-auto pt-4">{trend}</div>}
    </div>
  );
}
