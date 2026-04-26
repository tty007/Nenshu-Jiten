import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "positive" | "negative" | "neutral";

type Props = {
  label: string;
  value: string | null;
  unit?: string;
  diffLabel?: string;
  diffTone?: Tone;
  diffCaption?: string;
  yoyLabel?: string;
  yoyTone?: Tone;
  unavailableLabel?: string;
};

const toneTextClass: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-ink-muted",
};

const toneBgClass: Record<Tone, string> = {
  positive: "bg-positive-50 text-positive-600",
  negative: "bg-negative-50 text-negative-600",
  neutral: "bg-surface-muted text-ink-muted",
};

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === "positive") return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />;
  if (tone === "negative") return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />;
  return <Minus className="h-3.5 w-3.5" aria-hidden />;
}

export function MetricCard({
  label,
  value,
  unit,
  diffLabel,
  diffTone = "neutral",
  diffCaption,
  yoyLabel,
  yoyTone = "neutral",
  unavailableLabel = "データなし",
}: Props) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5">
      <p className="text-base font-medium text-ink-muted">{label}</p>
      {value === null ? (
        <>
          <p className="mt-2 font-numeric text-3xl font-bold tracking-tight text-ink-subtle tabular-nums">
            —
          </p>
          <p className="mt-3 text-base text-ink-subtle">{unavailableLabel}</p>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-numeric text-3xl font-bold tracking-tight text-ink tabular-nums">
              {value}
            </span>
            {unit && <span className="text-sm text-ink-muted">{unit}</span>}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {diffLabel && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-base font-semibold",
                    toneBgClass[diffTone]
                  )}
                >
                  <ToneIcon tone={diffTone} />
                  <span className="font-numeric tabular-nums">{diffLabel}</span>
                </span>
                {diffCaption && (
                  <span className="text-base text-ink-muted">{diffCaption}</span>
                )}
              </div>
            )}
            {yoyLabel && (
              <div className="flex items-center gap-1">
                <span className={cn("text-base font-medium", toneTextClass[yoyTone])}>
                  前年比 {yoyLabel}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
