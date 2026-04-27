"use client";

import { AxisBottom, AxisLeft, AxisRight } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, Circle, LinePath } from "@visx/shape";
import {
  TooltipWithBounds,
  defaultStyles,
  useTooltip,
} from "@visx/tooltip";
import { useEffect, useMemo, useRef } from "react";
import type { BrandColor } from "@/types";

export type EarningsDatum = {
  fiscalYear: number;
  revenue: number | null;
  operatingIncome: number | null;
  ordinaryIncome: number | null;
};

const COLOR_OPERATING = "#111827";
const COLOR_ORDINARY = "#6B7280";
const COLOR_ZERO_LINE = "#DC2626";

const COMPACT_BREAKPOINT = 480;

type YenUnit = "oku" | "man" | "yen";

function pickYenUnit(values: number[]): YenUnit {
  const maxAbs = values.length ? Math.max(...values.map((v) => Math.abs(v))) : 0;
  if (maxAbs >= 100_000_000) return "oku";
  if (maxAbs >= 10_000) return "man";
  return "yen";
}

function formatYenAxis(value: number, unit: YenUnit): string {
  if (value === 0) return "0";
  if (unit === "oku") {
    const v = value / 100_000_000;
    const decimals = Math.abs(v) >= 10 ? 0 : 1;
    return `${v.toFixed(decimals)}億`;
  }
  if (unit === "man") {
    return `${Math.round(value / 10_000).toLocaleString("ja-JP")}万`;
  }
  return value.toLocaleString("ja-JP");
}

function formatYenWithUnit(value: number, unit: YenUnit): string {
  if (unit === "oku") {
    return `${(value / 100_000_000).toFixed(1)}億円`;
  }
  if (unit === "man") {
    return `${Math.round(value / 10_000).toLocaleString("ja-JP")}万円`;
  }
  return `${value.toLocaleString("ja-JP")}円`;
}

// 軸目盛がすでに「億」「万」のSI接頭辞を含むため、補足のラベルは常に「円」。
function unitLabel(_unit: YenUnit): string {
  return "円";
}

const tooltipStyles: React.CSSProperties = {
  ...defaultStyles,
  background: "rgba(17, 24, 39, 0.95)",
  color: "white",
  borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.75rem",
  lineHeight: 1.5,
  border: "none",
};

type Props = {
  data: EarningsDatum[];
  brandColor: BrandColor;
};

export function EarningsTrendChart({ data, brandColor }: Props) {
  return (
    <div>
      <Legend brandColor={brandColor} />
      <div className="mt-3 h-80 w-full">
        <ParentSize>
          {({ width, height }) =>
            width > 0 && height > 0 ? (
              <ChartInner
                width={width}
                height={height}
                data={data}
                brandColor={brandColor}
              />
            ) : null
          }
        </ParentSize>
      </div>
    </div>
  );
}

function Legend({ brandColor }: { brandColor: BrandColor }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-sm"
          style={{
            background: `linear-gradient(180deg, ${brandColor.from}, ${brandColor.to})`,
          }}
        />
        売上高（左軸）
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-[2px] w-5"
          style={{ background: COLOR_OPERATING }}
        />
        営業利益（右軸）
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-[2px] w-5 border-t-2 border-dashed"
          style={{ borderColor: COLOR_ORDINARY }}
        />
        経常利益（右軸）
      </span>
      <span className="text-sm text-ink-subtle">単位: 円</span>
    </div>
  );
}

function ChartInner({
  width,
  height,
  data,
  brandColor,
}: {
  width: number;
  height: number;
  data: EarningsDatum[];
  brandColor: BrandColor;
}) {
  const isCompact = width < COMPACT_BREAKPOINT;
  const margin = {
    top: 16,
    right: isCompact ? 40 : 80,
    bottom: 36,
    left: isCompact ? 40 : 80,
  };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(
    () =>
      scaleBand<number>({
        domain: data.map((d) => d.fiscalYear),
        range: [0, innerWidth],
        padding: 0.65,
      }),
    [data, innerWidth]
  );

  const revenuePoints = useMemo(
    () =>
      data.filter((d): d is EarningsDatum & { revenue: number } =>
        d.revenue !== null
      ),
    [data]
  );
  const operatingPoints = useMemo(
    () =>
      data.filter((d): d is EarningsDatum & { operatingIncome: number } =>
        d.operatingIncome !== null
      ),
    [data]
  );
  const ordinaryPoints = useMemo(
    () =>
      data.filter((d): d is EarningsDatum & { ordinaryIncome: number } =>
        d.ordinaryIncome !== null
      ),
    [data]
  );

  // 左軸：売上高（常に正、0スタート）
  const yLeftScale = useMemo(() => {
    const max = Math.max(0, ...revenuePoints.map((d) => d.revenue));
    return scaleLinear<number>({
      domain: [0, max * 1.1 || 1],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [revenuePoints, innerHeight]);

  // 右軸：営業利益・経常利益（負値を含み得る）
  const yRightScale = useMemo(() => {
    const profitValues = [
      ...operatingPoints.map((d) => d.operatingIncome),
      ...ordinaryPoints.map((d) => d.ordinaryIncome),
    ];
    const profitMax = profitValues.length ? Math.max(0, ...profitValues) : 1;
    const profitMin = profitValues.length ? Math.min(0, ...profitValues) : 0;
    const padding = (profitMax - profitMin) * 0.15 || Math.abs(profitMax || profitMin) * 0.1 || 1;
    return scaleLinear<number>({
      domain: [profitMin < 0 ? profitMin - padding : 0, profitMax + padding],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [operatingPoints, ordinaryPoints, innerHeight]);

  const hasNegativeProfit = useMemo(
    () =>
      operatingPoints.some((d) => d.operatingIncome < 0) ||
      ordinaryPoints.some((d) => d.ordinaryIncome < 0),
    [operatingPoints, ordinaryPoints]
  );

  const leftUnit = useMemo(
    () => pickYenUnit(revenuePoints.map((d) => d.revenue)),
    [revenuePoints]
  );
  const rightUnit = useMemo(
    () =>
      pickYenUnit([
        ...operatingPoints.map((d) => d.operatingIncome),
        ...ordinaryPoints.map((d) => d.ordinaryIncome),
      ]),
    [operatingPoints, ordinaryPoints]
  );
  const tooltipUnit = useMemo(
    () =>
      pickYenUnit([
        ...revenuePoints.map((d) => d.revenue),
        ...operatingPoints.map((d) => d.operatingIncome),
        ...ordinaryPoints.map((d) => d.ordinaryIncome),
      ]),
    [revenuePoints, operatingPoints, ordinaryPoints]
  );

  const lineX = (d: EarningsDatum) =>
    (xScale(d.fiscalYear) ?? 0) + xScale.bandwidth() / 2;

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<EarningsDatum>();

  const containerRef = useRef<HTMLDivElement>(null);
  const isTouchRef = useRef(false);

  function updateTooltipFromEvent(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point) return;
    const x = point.x - margin.left;
    let nearest = data[0];
    let nearestDist = Infinity;
    for (const d of data) {
      const cx = (xScale(d.fiscalYear) ?? 0) + xScale.bandwidth() / 2;
      const dist = Math.abs(cx - x);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = d;
      }
    }
    const tooltipAnchor =
      nearest.operatingIncome ?? nearest.ordinaryIncome ?? 0;
    showTooltip({
      tooltipData: nearest,
      tooltipLeft: lineX(nearest) + margin.left,
      tooltipTop: yRightScale(tooltipAnchor) + margin.top,
    });
  }

  function handlePointerDown(event: React.PointerEvent<SVGRectElement>) {
    isTouchRef.current = event.pointerType === "touch";
    updateTooltipFromEvent(event);
  }

  function handlePointerLeave() {
    if (!isTouchRef.current) hideTooltip();
  }

  useEffect(() => {
    if (!tooltipOpen || !isTouchRef.current) return;
    function handleOutside(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        hideTooltip();
        isTouchRef.current = false;
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [tooltipOpen, hideTooltip]);

  const rightBaselineY = yRightScale(0);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="売上高・営業利益・経常利益の推移"
      >
        <defs>
          <linearGradient id="earnings-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brandColor.from} />
            <stop offset="100%" stopColor={brandColor.to} />
          </linearGradient>
        </defs>
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yLeftScale}
            width={innerWidth}
            stroke="#E5E7EB"
            strokeDasharray="2,2"
            numTicks={5}
          />
          <AxisLeft
            scale={yLeftScale}
            numTicks={5}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickFormat={(v) => formatYenAxis(Number(v), leftUnit)}
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 11,
              textAnchor: "end",
              dx: -4,
              dy: 3,
            })}
          />
          <AxisRight
            scale={yRightScale}
            left={innerWidth}
            numTicks={5}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickFormat={(v) => formatYenAxis(Number(v), rightUnit)}
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 11,
              textAnchor: "start",
              dx: 4,
              dy: 3,
            })}
          />
          {/* 軸単位のラベルは SVG ではなく HTML 側で表示する（モバイルで軸と被る対策）。
              下記の <text> は意図的に非表示。 */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickFormat={(v) => `${v}年`}
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 11,
              textAnchor: "middle",
              dy: 4,
            })}
          />

          {/* 売上高（棒・左軸） */}
          {revenuePoints.map((d) => {
            const x = xScale(d.fiscalYear) ?? 0;
            const y = yLeftScale(d.revenue);
            const barHeight = innerHeight - y;
            const isHover =
              tooltipOpen && tooltipData?.fiscalYear === d.fiscalYear;
            return (
              <Bar
                key={`bar-${d.fiscalYear}`}
                x={x}
                y={y}
                width={xScale.bandwidth()}
                height={Math.max(0, barHeight)}
                fill="url(#earnings-bar-grad)"
                rx={4}
                opacity={isHover ? 1 : 0.85}
              />
            );
          })}

          {/* 0 ライン（右軸基準）— 営業利益または経常利益に赤字がある場合のみ */}
          {hasNegativeProfit && (
            <line
              x1={0}
              x2={innerWidth}
              y1={rightBaselineY}
              y2={rightBaselineY}
              stroke={COLOR_ZERO_LINE}
              strokeWidth={1.25}
              strokeDasharray="6,3"
            />
          )}

          {/* 経常利益（線・点線・右軸） */}
          <LinePath
            data={ordinaryPoints}
            x={lineX}
            y={(d) => yRightScale(d.ordinaryIncome)}
            stroke={COLOR_ORDINARY}
            strokeWidth={2}
            strokeDasharray="5,4"
            curve={curveMonotoneX}
          />
          {/* 営業利益（線・実線・右軸） */}
          <LinePath
            data={operatingPoints}
            x={lineX}
            y={(d) => yRightScale(d.operatingIncome)}
            stroke={COLOR_OPERATING}
            strokeWidth={2.5}
            curve={curveMonotoneX}
          />
          {ordinaryPoints.map((d) => (
            <Circle
              key={`ord-${d.fiscalYear}`}
              cx={lineX(d)}
              cy={yRightScale(d.ordinaryIncome)}
              r={3}
              fill="white"
              stroke={COLOR_ORDINARY}
              strokeWidth={1.5}
            />
          ))}
          {operatingPoints.map((d) => (
            <Circle
              key={`op-${d.fiscalYear}`}
              cx={lineX(d)}
              cy={yRightScale(d.operatingIncome)}
              r={3.5}
              fill={COLOR_OPERATING}
            />
          ))}

          {tooltipOpen && tooltipData && (
            <line
              x1={lineX(tooltipData)}
              x2={lineX(tooltipData)}
              y1={0}
              y2={innerHeight}
              stroke="#9CA3AF"
              strokeDasharray="2,2"
            />
          )}

          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            style={{ touchAction: "pan-y" }}
            onPointerDown={handlePointerDown}
            onPointerMove={updateTooltipFromEvent}
            onPointerLeave={handlePointerLeave}
          />
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          style={tooltipStyles}
        >
          <div className="font-numeric font-semibold tabular-nums">
            {tooltipData.fiscalYear}年度
          </div>
          <div className="mt-1.5 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{
                  background: `linear-gradient(180deg, ${brandColor.from}, ${brandColor.to})`,
                }}
              />
              売上高
            </span>
            <span className="text-right font-numeric font-semibold tabular-nums">
              {tooltipData.revenue !== null ? formatYenWithUnit(tooltipData.revenue, tooltipUnit) : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-[2px] w-3"
                style={{ background: COLOR_OPERATING }}
              />
              営業利益
            </span>
            <span className="text-right font-numeric font-semibold tabular-nums">
              {tooltipData.operatingIncome !== null
                ? formatYenWithUnit(tooltipData.operatingIncome, tooltipUnit)
                : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-[2px] w-3 border-t-2 border-dashed"
                style={{ borderColor: COLOR_ORDINARY }}
              />
              経常利益
            </span>
            <span className="text-right font-numeric font-semibold tabular-nums">
              {tooltipData.ordinaryIncome !== null
                ? formatYenWithUnit(tooltipData.ordinaryIncome, tooltipUnit)
                : "—"}
            </span>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}
