import type { BrandColor } from "@/types";

// 業種コードに対応した固定パレット。同じ業種の企業は同じ色になる。
const PALETTE: BrandColor[] = [
  { primary: "#0F766E", from: "#14B8A6", to: "#0F766E", onPrimary: "#FFFFFF" }, // teal
  { primary: "#1D4ED8", from: "#3B82F6", to: "#1D4ED8", onPrimary: "#FFFFFF" }, // blue
  { primary: "#9F1239", from: "#BE123C", to: "#9F1239", onPrimary: "#FFFFFF" }, // rose
  { primary: "#C2410C", from: "#EA580C", to: "#C2410C", onPrimary: "#FFFFFF" }, // orange
  { primary: "#475569", from: "#64748B", to: "#475569", onPrimary: "#FFFFFF" }, // slate
  { primary: "#6D28D9", from: "#8B5CF6", to: "#6D28D9", onPrimary: "#FFFFFF" }, // violet
  { primary: "#0E7490", from: "#0891B2", to: "#0E7490", onPrimary: "#FFFFFF" }, // cyan
  { primary: "#B45309", from: "#D97706", to: "#B45309", onPrimary: "#FFFFFF" }, // amber
];

const FALLBACK: BrandColor = PALETTE[4];

export function brandColorFor(industryCode: string | null | undefined): BrandColor {
  if (!industryCode) return FALLBACK;
  const hash = industryCode
    .split("")
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
  return PALETTE[hash % PALETTE.length];
}
