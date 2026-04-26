import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Minus,
} from "lucide-react";
import { Fragment } from "react";
import type { PositionSalaryEstimateResult } from "@/lib/data/position-salary";
import { formatSalary } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Props = {
  result: PositionSalaryEstimateResult;
  fiscalYear: number;
};

export function PositionSalaryEstimateSection({ result, fiscalYear }: Props) {
  // 非役職 → 係長 → 課長 → 部長 の順（年収が上がる方向）
  const ascending = [...result.estimates].sort(
    (a, b) => a.estimatedAnnualSalary - b.estimatedAnnualSalary
  );

  return (
    <section className="mt-8 rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
            役職別の推定年収
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            国の役職別賃金統計と、この会社の平均年収から逆算した推計値（昇進ステップ順）
          </p>
        </div>
        <Briefcase className="h-5 w-5 text-ink-muted" aria-hidden />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-2">
        {ascending.map((e, i) => {
          const next = ascending[i + 1];
          const stepUpPct = next
            ? ((next.estimatedAnnualSalary - e.estimatedAnnualSalary) /
                e.estimatedAnnualSalary) *
              100
            : null;
          const isTop = i === ascending.length - 1;
          const diff = e.vsCompanyAveragePct;
          const tone: "positive" | "negative" | "neutral" =
            diff > 1 ? "positive" : diff < -1 ? "negative" : "neutral";

          return (
            <Fragment key={e.role}>
              <div
                className={cn(
                  "flex-1 rounded-xl border border-surface-border bg-surface-muted/40 p-4 transition",
                  isTop && "border-brand-100 bg-brand-50/40"
                )}
              >
                <span className="inline-flex items-center rounded-full bg-brand-600 px-3 py-1 text-sm font-bold text-white">
                  {e.role}
                </span>
                <p className="mt-2 pl-1 text-sm text-ink-subtle">
                  国 平均{e.nationalAge.toFixed(1)}歳
                </p>
                <p className="mt-3 font-numeric text-2xl font-bold tabular-nums text-ink">
                  {formatSalary(e.estimatedAnnualSalary)}
                </p>
                <DiffPill diff={diff} tone={tone} />
              </div>

              {next && (
                <div
                  aria-hidden
                  className="flex shrink-0 items-center justify-center gap-1 lg:flex-col lg:gap-0"
                >
                  <ChevronRight className="hidden h-5 w-5 text-brand-400 lg:block" />
                  <ChevronDown className="h-5 w-5 text-brand-400 lg:hidden" />
                  {stepUpPct !== null && (
                    <span className="font-numeric text-sm font-semibold tabular-nums text-brand-600">
                      +{stepUpPct.toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <details className="mt-5 text-base text-ink-muted">
        <summary className="cursor-pointer">推計の前提と注意</summary>
        <div className="mt-2 space-y-2 pl-1 leading-relaxed">
          <p>
            この会社の{fiscalYear}年度・平均年齢
            <span className="font-numeric tabular-nums">
              {result.companyAvgAge.toFixed(1)}
            </span>
            歳・平均年収
            <span className="font-numeric tabular-nums">
              {formatSalary(result.companyAvgAnnualSalary)}
            </span>
            と、令和7年度
            <a
              href="https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2024/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              賃金構造基本統計調査
            </a>
            （男女計）の役職別賃金から推計しています。
          </p>
          <p>
            手順：① 国の役職構成比（部長級
            {(result.composition.部長級 * 100).toFixed(0)}%／課長級
            {(result.composition.課長級 * 100).toFixed(0)}%／係長級
            {(result.composition.係長級 * 100).toFixed(0)}%／非役職者
            {(result.composition.非役職者 * 100).toFixed(0)}%）と国の役職別賃金比から、
            国の加重平均賃金は非役職者の
            <span className="font-numeric tabular-nums">
              {result.overallVsNonPositionRatio.toFixed(3)}
            </span>
            倍となる。
            ② 会社の平均年収 ÷ この倍率で、会社の非役職者推定年収（
            <span className="font-numeric tabular-nums">
              {formatSalary(result.nonPositionEstimate)}
            </span>
            ）を逆算。
            ③ 国の役職別賃金比（部長 2.05倍／課長 1.70倍／係長 1.29倍）を非役職者推定にかけて各役職の推定年収を算出。
          </p>
          <p>
            ※役職構成・賞与水準が国平均と同等という仮定の上での
            <strong>あくまで推計値</strong>です。会社が公表している実額ではありません。
            平均年齢は参考情報として表示しているだけで、推計式には使用していません。
          </p>
        </div>
      </details>
    </section>
  );
}

function DiffPill({
  diff,
  tone,
}: {
  diff: number;
  tone: "positive" | "negative" | "neutral";
}) {
  const Icon = tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : Minus;
  const sign = diff > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "mt-2 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-sm font-semibold",
        tone === "positive" && "bg-positive-50 text-positive-600",
        tone === "negative" && "bg-negative-50 text-negative-600",
        tone === "neutral" && "bg-surface-muted text-ink-muted"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span className="font-numeric tabular-nums">
        平均比 {sign}
        {diff.toFixed(1)}%
      </span>
    </span>
  );
}
