import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IndustryBadge, MarketBadge } from "@/components/IndustryBadge";
import { getIndustryAverage } from "@/lib/data/industry-averages";
import {
  diffPercent,
  formatDiff,
  formatNumber,
  formatSalary,
} from "@/lib/utils";
import type { CompanyWithLatestMetrics } from "@/types";
import { cn } from "@/lib/utils";

export async function CompanyCard({
  company,
  variant = "default",
}: {
  company: CompanyWithLatestMetrics;
  variant?: "default" | "compact";
}) {
  const m = company.latest;
  const ind = await getIndustryAverage(company.industryCode, m.fiscalYear);
  const salaryDiff =
    ind && m.averageAnnualSalary !== null
      ? formatDiff(diffPercent(m.averageAnnualSalary, ind.avgAnnualSalary))
      : null;

  return (
    <Link
      href={`/companies/${company.edinetCode}`}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-surface-border bg-white p-5 transition",
        "hover:border-brand-100 hover:shadow-sm focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <IndustryBadge name={company.industryName} />
        <MarketBadge market={company.listedMarket} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-ink group-hover:text-brand">
          {company.name}
        </h3>
        {variant === "default" && company.description && (
          <p className="mt-1 line-clamp-2 text-base text-ink-muted">
            {company.description}
          </p>
        )}
      </div>
      <dl className="mt-1 grid grid-cols-3 gap-3 border-t border-surface-border pt-3 text-base">
        <div>
          <dt className="text-ink-muted">平均年収</dt>
          <dd className="mt-0.5 font-numeric text-base font-semibold text-ink tabular-nums">
            {m.averageAnnualSalary !== null ? formatSalary(m.averageAnnualSalary) : "—"}
          </dd>
          {salaryDiff && (
            <dd
              className={cn(
                "mt-0.5 text-sm font-medium",
                salaryDiff.tone === "positive" && "text-positive-600",
                salaryDiff.tone === "negative" && "text-negative-600",
                salaryDiff.tone === "neutral" && "text-ink-muted"
              )}
            >
              業界比 {salaryDiff.label}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-ink-muted">勤続年数</dt>
          <dd className="mt-0.5 font-numeric text-base font-semibold text-ink tabular-nums">
            {m.averageTenureYears !== null ? (
              <>
                {m.averageTenureYears.toFixed(1)}
                <span className="ml-0.5 text-base font-normal text-ink-muted">年</span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">従業員数</dt>
          <dd className="mt-0.5 font-numeric text-base font-semibold text-ink tabular-nums">
            {m.employeeCount !== null ? (
              <>
                {formatNumber(m.employeeCount)}
                <span className="ml-0.5 text-base font-normal text-ink-muted">人</span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-1 inline-flex items-center gap-1 text-base font-medium text-brand">
        詳細を見る
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
