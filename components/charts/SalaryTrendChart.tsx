"use client";

import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { Bar, Circle, LinePath } from "@visx/shape";
import {
  TooltipWithBounds,
  defaultStyles,
  useTooltip,
} from "@visx/tooltip";
import { extent } from "d3-array";
import { useMemo } from "react";
import { formatSalary } from "@/lib/utils";

export type SalaryTrendDatum = {
  fiscalYear: number;
  companySalary: number;
  industrySalary: number;
};

type Props = {
  data: SalaryTrendDatum[];
  companyName: string;
  industryName: string;
};

const margin = { top: 16, right: 24, bottom: 36, left: 64 };

const tooltipStyles: React.CSSProperties = {
  ...defaultStyles,
  background: "rgba(17, 24, 39, 0.95)",
  color: "white",
  borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.75rem",
  lineHeight: 1.4,
  border: "none",
};

export function SalaryTrendChart(props: Props) {
  return (
    <div className="h-72 w-full">
      <ParentSize>
        {({ width, height }) =>
          width > 0 && height > 0 ? (
            <SalaryTrendChartInner width={width} height={height} {...props} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}

function SalaryTrendChartInner({
  width,
  height,
  data,
  companyName,
  industryName,
}: Props & { width: number; height: number }) {
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(() => {
    const [minY, maxY] = extent(data, (d) => d.fiscalYear) as [number, number];
    return scaleLinear<number>({
      domain: [minY, maxY],
      range: [0, innerWidth],
    });
  }, [data, innerWidth]);

  const yScale = useMemo(() => {
    const allValues = data.flatMap((d) => [d.companySalary, d.industrySalary]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const padding = (maxVal - minVal) * 0.2 || maxVal * 0.05;
    return scaleLinear<number>({
      domain: [Math.max(0, minVal - padding), maxVal + padding],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [data, innerHeight]);

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<SalaryTrendDatum>();

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point) return;
    const x = point.x - margin.left;
    const xVal = xScale.invert(x);
    let nearest = data[0];
    let nearestDist = Infinity;
    for (const d of data) {
      const dist = Math.abs(d.fiscalYear - xVal);
      if (dist < nearestDist) {
        nearest = d;
        nearestDist = dist;
      }
    }
    showTooltip({
      tooltipData: nearest,
      tooltipLeft: xScale(nearest.fiscalYear) + margin.left,
      tooltipTop: yScale(nearest.companySalary) + margin.top,
    });
  }

  return (
    <div className="relative h-full w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${companyName}と${industryName}業界平均の平均年収推移`}
      >
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            stroke="#E5E7EB"
            strokeDasharray="2,2"
            numTicks={5}
          />
          <AxisLeft
            scale={yScale}
            numTicks={5}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickFormat={(v) => formatSalary(Number(v))}
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 11,
              textAnchor: "end",
              dx: -4,
              dy: 3,
            })}
          />
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            numTicks={data.length}
            stroke="#9CA3AF"
            tickStroke="#9CA3AF"
            tickFormat={(v) => `${Math.round(Number(v))}年`}
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 11,
              textAnchor: "middle",
              dy: 4,
            })}
          />
          <LinePath
            data={data}
            x={(d) => xScale(d.fiscalYear)}
            y={(d) => yScale(d.industrySalary)}
            stroke="#9CA3AF"
            strokeWidth={2}
            strokeDasharray="4,4"
            curve={curveMonotoneX}
          />
          <LinePath
            data={data}
            x={(d) => xScale(d.fiscalYear)}
            y={(d) => yScale(d.companySalary)}
            stroke="#1E3A8A"
            strokeWidth={2.5}
            curve={curveMonotoneX}
          />
          {data.map((d) => (
            <Circle
              key={`p-${d.fiscalYear}`}
              cx={xScale(d.fiscalYear)}
              cy={yScale(d.companySalary)}
              r={3.5}
              fill="#1E3A8A"
            />
          ))}
          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={hideTooltip}
          />
          {tooltipOpen && tooltipData && (
            <line
              x1={xScale(tooltipData.fiscalYear)}
              x2={xScale(tooltipData.fiscalYear)}
              y1={0}
              y2={innerHeight}
              stroke="#9CA3AF"
              strokeDasharray="2,2"
            />
          )}
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
          <div className="mt-1 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "#1E3A8A" }}
            />
            <span>{companyName}</span>
            <span className="ml-auto font-numeric font-semibold tabular-nums">
              {formatSalary(tooltipData.companySalary)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-ink-subtle">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "#9CA3AF" }}
            />
            <span>{industryName}平均</span>
            <span className="ml-auto font-numeric tabular-nums">
              {formatSalary(tooltipData.industrySalary)}
            </span>
          </div>
        </TooltipWithBounds>
      )}
      <div className="absolute right-2 top-2 flex items-center gap-3 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 bg-brand" /> {companyName}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 border-t-2 border-dashed border-ink-subtle" />
          {industryName}平均
        </span>
      </div>
    </div>
  );
}
