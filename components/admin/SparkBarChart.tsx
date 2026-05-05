type Props = {
  data: { date: string; count: number }[];
  height?: number;
  ariaLabel?: string;
};

/**
 * 日次の小カウントを縦棒で並べる軽量スパークライン。
 * SSR フレンドリーに inline SVG で描画（visx を使うほどでもないため）。
 */
export function SparkBarChart({
  data,
  height = 60,
  ariaLabel = "日別件数",
}: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const barCount = data.length;
  if (barCount === 0) return null;
  const barWidthPct = 100 / barCount;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="block h-16 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {data.map((d, i) => {
          const h = (d.count / max) * height;
          return (
            <rect
              key={d.date}
              x={i * barWidthPct + barWidthPct * 0.1}
              y={height - h}
              width={barWidthPct * 0.8}
              height={h}
              rx={0.6}
              fill="url(#spark-gradient)"
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
          );
        })}
        <defs>
          <linearGradient id="spark-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex items-center justify-between text-xs text-ink-subtle">
        <span>{data[0]?.date.slice(5).replace("-", "/")}</span>
        <span>合計 {total.toLocaleString("ja-JP")}</span>
        <span>{data[data.length - 1]?.date.slice(5).replace("-", "/")}</span>
      </div>
    </div>
  );
}
