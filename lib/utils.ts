import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatYen(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}億円`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toLocaleString("ja-JP", {
      maximumFractionDigits: 0,
    })}万円`;
  }
  return `${value.toLocaleString("ja-JP")}円`;
}

export function formatSalary(value: number): string {
  return `${(value / 10_000).toFixed(0)}万円`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function diffPercent(value: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((value - baseline) / baseline) * 100;
}

export function formatDiff(diff: number): {
  label: string;
  tone: "positive" | "negative" | "neutral";
} {
  const rounded = Math.round(diff * 10) / 10;
  if (rounded > 0.05) {
    return { label: `+${rounded.toFixed(1)}%`, tone: "positive" };
  }
  if (rounded < -0.05) {
    return { label: `${rounded.toFixed(1)}%`, tone: "negative" };
  }
  return { label: `±0%`, tone: "neutral" };
}
