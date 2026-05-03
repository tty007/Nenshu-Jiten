import { Building2, ExternalLink } from "lucide-react";
import type { Company, FinancialMetric } from "@/types";
import { formatNumber, formatYen } from "@/lib/utils";

type Props = {
  company: Company;
  latest: FinancialMetric;
};

export function CompanyBasicInfoTable({ company, latest }: Props) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [];
  rows.push({ label: "会社名", value: company.name });
  if (company.representative) {
    rows.push({ label: "代表者", value: company.representative });
  }
  if (company.headquarters) {
    rows.push({ label: "本社所在地", value: company.headquarters });
  }
  rows.push({ label: "設立日", value: formatFoundedAt(company) });
  if (company.capitalStockYen !== null) {
    rows.push({
      label: "資本金",
      value: (
        <span className="font-numeric tabular-nums">
          {formatYen(company.capitalStockYen)}
        </span>
      ),
    });
  }
  if (latest.employeeCount !== null) {
    rows.push({
      label: `従業員数（${latest.fiscalYear}年度）`,
      value: (
        <span>
          <span className="font-numeric tabular-nums">
            {formatNumber(latest.employeeCount)}
          </span>{" "}
          人
        </span>
      ),
    });
  }
  if (latest.revenue !== null) {
    rows.push({
      label: `売上高（${latest.fiscalYear}年度）`,
      value: (
        <span className="font-numeric tabular-nums">
          {formatYen(latest.revenue)}
        </span>
      ),
    });
  }
  if (company.fiscalYearEndMonth) {
    rows.push({
      label: "決算期",
      value: `${company.fiscalYearEndMonth}月`,
    });
  }
  if (company.websiteUrl) {
    rows.push({
      label: "公式サイト",
      value: (
        <a
          href={company.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 break-all text-brand hover:text-brand-700 hover:underline"
        >
          {company.websiteUrl}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
      ),
    });
  }
  if (company.corporateNumber) {
    rows.push({
      label: "法人番号",
      value: (
        <span className="font-numeric tabular-nums">
          {company.corporateNumber}
        </span>
      ),
    });
  }
  if (company.industryName) {
    rows.push({ label: "業種", value: company.industryName });
  }

  return (
    <section className="mt-8 rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
            企業基本情報
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            会社プロフィール（有価証券報告書および gBizINFO より）
          </p>
        </div>
        <Building2 className="h-5 w-5 text-ink-muted" aria-hidden />
      </div>
      <dl className="mt-6 divide-y divide-surface-border border-y border-surface-border text-sm">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[8rem_1fr] gap-3 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6"
          >
            <dt className="text-ink-muted">{r.label}</dt>
            <dd className="min-w-0 text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-ink-subtle">
        ※ 設立日・公式サイト・資本金・法人番号は{" "}
        <a
          href="https://info.gbiz.go.jp/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink hover:underline"
        >
          gBizINFO（経済産業省）
        </a>
        を出典としています。代表者・決算期は同社の有価証券報告書から取得しています。
      </p>
    </section>
  );
}

function formatFoundedAt(company: Company): React.ReactNode {
  // foundedAt が ISO 日付ならその年・月を出す。無ければ founded_year を使う。
  if (company.foundedAt) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(company.foundedAt);
    if (m) return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
  }
  if (company.foundedYear) return `${company.foundedYear}年`;
  return <span className="text-ink-subtle">-</span>;
}
