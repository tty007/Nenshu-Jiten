type Props = {
  label: string;
  count: number;
  total: number;
};

export function ProgressBar({ label, count, total }: Props) {
  const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-numeric tabular-nums text-ink-muted">
          {count.toLocaleString("ja-JP")} / {total.toLocaleString("ja-JP")}{" "}
          <span className="text-ink-subtle">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <span
          aria-hidden
          className="block h-full rounded-full bg-gradient-to-r from-blue-700 to-sky-400"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
