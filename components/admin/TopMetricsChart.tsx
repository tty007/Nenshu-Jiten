"use client";

import { useCallback, useMemo, useState } from "react";
import { AxisBottom, AxisLeft, AxisRight } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import {
  defaultStyles as tooltipDefaultStyles,
  TooltipWithBounds,
  useTooltip,
} from "@visx/tooltip";
import { cn } from "@/lib/utils";

export type MetricPoint = {
  date: string;
  usersNew: number;
  usersTotal: number;
  pageViews: number | null;
};

type Props = {
  data: MetricPoint[];
};

type SeriesKey = "usersNew" | "usersTotal" | "pageViews";

const SERIES: {
  key: SeriesKey;
  label: string;
  color: string;
  type: "bar" | "line";
}[] = [
  { key: "usersNew", label: "新規ユーザー", color: "#2563eb", type: "bar" },
  { key: "usersTotal", label: "累計ユーザー", color: "#0ea5e9", type: "line" },
  { key: "pageViews", label: "PV", color: "#f97316", type: "line" },
];

export function TopMetricsChart({ data }: Props) {
  const [enabled, setEnabled] = useState<Record<SeriesKey, boolean>>({
    usersNew: true,
    usersTotal: true,
    pageViews: true,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SERIES.map((s) => {
          const active = enabled[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setEnabled((e) => ({ ...e, [s.key]: !e[s.key] }))}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                active
                  ? "border-transparent text-white"
                  : "border-surface-border bg-white text-ink-muted hover:bg-surface-muted"
              )}
              style={
                active
                  ? { backgroundColor: s.color }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? "#fff" : s.color }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="relative h-72 w-full">
        <ParentSize>
          {({ width, height }) =>
            width < 50 ? null : (
              <Chart
                width={width}
                height={height}
                data={data}
                enabled={enabled}
              />
            )
          }
        </ParentSize>
      </div>
    </div>
  );
}

function Chart({
  width,
  height,
  data,
  enabled,
}: {
  width: number;
  height: number;
  data: MetricPoint[];
  enabled: Record<SeriesKey, boolean>;
}) {
  const margin = { top: 12, right: 56, bottom: 32, left: 48 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        domain: data.map((d) => d.date),
        range: [0, innerW],
        padding: 0.2,
      }),
    [data, innerW]
  );

  // 左軸: usersNew (バー)。右軸: usersTotal + pageViews (line)
  const leftMax = enabled.usersNew
    ? Math.max(1, ...data.map((d) => d.usersNew))
    : 1;
  const rightVals: number[] = [];
  if (enabled.usersTotal) rightVals.push(...data.map((d) => d.usersTotal));
  if (enabled.pageViews)
    rightVals.push(...data.map((d) => d.pageViews ?? 0));
  const rightMax = rightVals.length > 0 ? Math.max(1, ...rightVals) : 1;

  const yLeft = scaleLinear<number>({
    domain: [0, leftMax * 1.1],
    range: [innerH, 0],
    nice: true,
  });
  const yRight = scaleLinear<number>({
    domain: [0, rightMax * 1.1],
    range: [innerH, 0],
    nice: true,
  });

  const xCenter = (date: string) =>
    (xScale(date) ?? 0) + xScale.bandwidth() / 2;

  // X 軸ラベルを間引き（10 個程度）
  const tickEvery = Math.max(1, Math.ceil(data.length / 8));
  const xTicks = data
    .filter((_, i) => i % tickEvery === 0 || i === data.length - 1)
    .map((d) => d.date);

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<MetricPoint>();

  const step = xScale.step();
  const handleMove = useCallback(
    (event: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>) => {
      const point = localPoint(event);
      if (!point || data.length === 0 || step <= 0) return;
      // overlay は margin.left オフセット内に置くので、point.x からそれを引く
      const x = point.x - margin.left;
      let idx = Math.floor(x / step);
      if (idx < 0) idx = 0;
      if (idx > data.length - 1) idx = data.length - 1;
      const d = data[idx];
      showTooltip({
        tooltipData: d,
        tooltipLeft: margin.left + xCenter(d.date),
        tooltipTop: margin.top,
      });
    },
    [data, step, margin.left, margin.top, showTooltip, xCenter]
  );

  return (
    <>
      <svg width={width} height={height} role="img" aria-label="トップ指標推移">
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yLeft}
            width={innerW}
            stroke="#E5E7EB"
            strokeDasharray="2,2"
            numTicks={4}
          />
          {/* バー: usersNew */}
          {enabled.usersNew &&
            data.map((d) => {
              const x = xScale(d.date) ?? 0;
              const y = yLeft(d.usersNew);
              const h = innerH - y;
              return (
                <Bar
                  key={`bar-${d.date}`}
                  x={x}
                  y={y}
                  width={xScale.bandwidth()}
                  height={Math.max(0, h)}
                  fill="#2563eb"
                  opacity={0.6}
                  rx={1}
                />
              );
            })}
          {/* ライン: usersTotal */}
          {enabled.usersTotal && (
            <LinePath<MetricPoint>
              data={data}
              x={(d) => xCenter(d.date)}
              y={(d) => yRight(d.usersTotal)}
              stroke="#0ea5e9"
              strokeWidth={2}
              curve={curveMonotoneX}
            />
          )}
          {/* ライン: pageViews */}
          {enabled.pageViews && (
            <LinePath<MetricPoint>
              data={data.filter((d) => d.pageViews !== null) as MetricPoint[]}
              x={(d) => xCenter(d.date)}
              y={(d) => yRight(d.pageViews ?? 0)}
              stroke="#f97316"
              strokeWidth={2}
              curve={curveMonotoneX}
              strokeDasharray="0"
            />
          )}
          <AxisLeft
            scale={yLeft}
            numTicks={4}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 10,
              textAnchor: "end",
              dx: -4,
              dy: 3,
            })}
          />
          <AxisRight
            scale={yRight}
            left={innerW}
            numTicks={4}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 10,
              textAnchor: "start",
              dx: 4,
              dy: 3,
            })}
          />
          <AxisBottom
            scale={xScale}
            top={innerH}
            tickValues={xTicks}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickFormat={(v) => String(v).slice(5).replace("-", "/")}
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 10,
              textAnchor: "middle",
              dy: 4,
            })}
          />
          {/* hover overlay + focus indicators */}
          {tooltipOpen && tooltipData && (
            <g pointerEvents="none">
              <line
                x1={xCenter(tooltipData.date)}
                x2={xCenter(tooltipData.date)}
                y1={0}
                y2={innerH}
                stroke="#9CA3AF"
                strokeDasharray="3,3"
                strokeWidth={1}
              />
              {enabled.usersTotal && (
                <circle
                  cx={xCenter(tooltipData.date)}
                  cy={yRight(tooltipData.usersTotal)}
                  r={4}
                  fill="#fff"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                />
              )}
              {enabled.pageViews && tooltipData.pageViews !== null && (
                <circle
                  cx={xCenter(tooltipData.date)}
                  cy={yRight(tooltipData.pageViews ?? 0)}
                  r={4}
                  fill="#fff"
                  stroke="#f97316"
                  strokeWidth={2}
                />
              )}
            </g>
          )}
          <Bar
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={hideTooltip}
            onTouchMove={handleMove}
            onTouchEnd={hideTooltip}
          />
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...tooltipDefaultStyles,
            backgroundColor: "rgba(17, 24, 39, 0.95)",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.5,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div className="font-semibold tabular-nums">
            {tooltipData.date.replace(/^\d{4}-/, "").replace("-", "/")}
          </div>
          <div className="mt-1 space-y-0.5">
            {enabled.usersNew && (
              <TooltipRow
                color="#2563eb"
                label="新規ユーザー"
                value={tooltipData.usersNew}
              />
            )}
            {enabled.usersTotal && (
              <TooltipRow
                color="#0ea5e9"
                label="累計ユーザー"
                value={tooltipData.usersTotal}
              />
            )}
            {enabled.pageViews && (
              <TooltipRow
                color="#f97316"
                label="PV"
                value={tooltipData.pageViews ?? 0}
              />
            )}
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 tabular-nums">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-white/80">{label}</span>
      <span className="ml-auto font-semibold">
        {value.toLocaleString("ja-JP")}
      </span>
    </div>
  );
}
