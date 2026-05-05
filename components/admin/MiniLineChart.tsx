type Point = { label: string; value: number };

type Props = {
  data: Point[];
  height?: number;
  color?: string;
  ariaLabel?: string;
};

/**
 * 5〜30 ポイント程度の時系列を 1 本のラインで描く小型チャート。
 * KPI カードの下に inline で表示して傾向だけ伝える用途。
 */
export function MiniLineChart({
  data,
  height = 48,
  color = "#2563eb",
  ariaLabel = "推移",
}: Props) {
  if (data.length === 0) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;

  const points = data
    .map((d, i) => {
      const x = i * stepX;
      const y = h - ((d.value - min) / range) * (h - 6) - 3; // top/bottom padding
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block h-12 w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) * stepX}
          cy={
            h -
            ((data[data.length - 1].value - min) / range) * (h - 6) -
            3
          }
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}
