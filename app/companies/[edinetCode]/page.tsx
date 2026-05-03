import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { CompanyCard } from "@/components/CompanyCard";
import { CompanyHero } from "@/components/CompanyHero";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MetricCard } from "@/components/MetricCard";
import { MhlwSection } from "@/components/MhlwSection";
import { GatedPositionSalary } from "@/components/GatedPositionSalary";
import { EarningsTrendChart } from "@/components/charts/EarningsTrendChart";
import { SalaryTrendChart } from "@/components/charts/SalaryTrendChart";
import {
  getCompaniesByIndustry,
  getCompanyByEdinetCode,
  getCompanyRankInIndustry,
} from "@/lib/data/companies";
import {
  getIndustryAverage,
  getIndustryAverageHistory,
} from "@/lib/data/industry-averages";
import { getMhlwForCompany } from "@/lib/data/mhlw";
import {
  diffPercent,
  formatDiff,
  formatNumber,
  formatPercent,
} from "@/lib/utils";

// ヘッダー内の <UserMenu /> が cookies() を読んでログイン状態を出すため、
// ページ全体を動的レンダリングする必要がある。ISR (revalidate) は
// cookies() と両立できず DYNAMIC_SERVER_USAGE で 500 になるため使用しない。
// SEO 用には app/sitemap.ts が全 EDINET コードを列挙しているのでクロール経路は維持される。
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edinetCode: string }>;
}): Promise<Metadata> {
  const { edinetCode } = await params;
  const company = await getCompanyByEdinetCode(edinetCode);
  if (!company) return { title: "企業が見つかりません" };
  const industryName = company.industryName ?? "業種未分類";
  const market = company.listedMarket ? `・${company.listedMarket}` : "";
  return {
    title: `${company.name}の平均年収・勤続年数・従業員数`,
    description: `${company.name}（${industryName}${market}）の平均年収・勤続年数・従業員数・業績を、業界平均と比較して掲載。データ出典は金融庁EDINETの有価証券報告書。`,
  };
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ edinetCode: string }>;
}) {
  const { edinetCode } = await params;
  const company = await getCompanyByEdinetCode(edinetCode);
  if (!company || company.history.length === 0) notFound();

  const latest = company.latest;
  const previous =
    company.history.length >= 2
      ? company.history[company.history.length - 2]
      : null;
  const indNow = await getIndustryAverage(company.industryCode, latest.fiscalYear);
  const indHistory = await getIndustryAverageHistory(company.industryCode);

  const peers = company.industryCode
    ? await getCompaniesByIndustry(company.industryCode, company.id, 5)
    : [];

  const mhlw = await getMhlwForCompany(company.id);
  // 役職別年収の数値は SSR HTML に載せず、ゲート API から認証ユーザーにのみ返す。
  // ここではセクションを描画するか否かだけを判定する。
  const positionEstimateAvailable =
    latest.averageAge !== null &&
    latest.averageAge > 0 &&
    latest.averageAnnualSalary !== null &&
    latest.averageAnnualSalary > 0;

  const salaryIndustryDiff =
    indNow && latest.averageAnnualSalary !== null
      ? formatDiff(diffPercent(latest.averageAnnualSalary, indNow.avgAnnualSalary))
      : null;
  const tenureDiff =
    indNow && latest.averageTenureYears !== null
      ? formatDiff(diffPercent(latest.averageTenureYears, indNow.avgTenureYears))
      : null;
  const employeesYoY =
    previous && latest.employeeCount !== null && previous.employeeCount !== null
      ? formatDiff(diffPercent(latest.employeeCount, previous.employeeCount))
      : null;
  const ageBaseline = 41.5;
  const ageDiff =
    latest.averageAge !== null
      ? formatDiff(diffPercent(latest.averageAge, ageBaseline))
      : null;
  const femaleManagerDiff =
    latest.femaleManagerRatio !== null && indNow?.avgFemaleManagerRatio
      ? formatDiff(latest.femaleManagerRatio - indNow.avgFemaleManagerRatio)
      : null;
  const overtimeDiff =
    latest.averageOvertimeHours !== null && indNow?.avgOvertimeHours
      ? formatDiff(
          -1 * diffPercent(latest.averageOvertimeHours, indNow.avgOvertimeHours)
        )
      : null;
  const salaryYoY =
    previous &&
    latest.averageAnnualSalary !== null &&
    previous.averageAnnualSalary !== null
      ? formatDiff(
          diffPercent(latest.averageAnnualSalary, previous.averageAnnualSalary)
        )
      : null;

  const salaryTrend = company.history
    .filter((m) => m.averageAnnualSalary !== null)
    .map((m) => {
      const ind = indHistory.find((a) => a.fiscalYear === m.fiscalYear);
      return {
        fiscalYear: m.fiscalYear,
        companySalary: m.averageAnnualSalary as number,
        industrySalary: ind?.avgAnnualSalary ?? (m.averageAnnualSalary as number),
      };
    });

  const earningsTrend = company.history
    .filter(
      (m) =>
        m.revenue !== null ||
        m.operatingIncome !== null ||
        m.ordinaryIncome !== null
    )
    .map((m) => ({
      fiscalYear: m.fiscalYear,
      revenue: m.revenue,
      operatingIncome: m.operatingIncome,
      ordinaryIncome: m.ordinaryIncome,
    }));

  const peerRank = company.industryCode
    ? await getCompanyRankInIndustry(
        company.id,
        company.industryCode,
        latest.averageAnnualSalary
      )
    : { rank: 1, total: 1 };

  const submittedDate = latest.submittedAt ? new Date(latest.submittedAt) : null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CompanyHero
          company={company}
          salaryIndustryDiff={salaryIndustryDiff}
          salaryYoY={salaryYoY}
          industryRank={peerRank}
        />

        {company.summary && (
          <section className="mt-8 rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
            <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
              企業概要
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink sm:text-base sm:leading-8">
              {company.summary}
            </p>
            <p className="mt-5 text-base text-ink-subtle">
              ※{latest.fiscalYear}年度提出の有価証券報告書から自動生成。
            </p>
          </section>
        )}

        <section className="mt-8">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
              働き方の主要指標
            </h2>
            <p className="text-base text-ink-muted">
              {latest.fiscalYear}年度実績
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:gap-4">
            <MetricCard
              label="平均勤続年数"
              value={
                latest.averageTenureYears !== null
                  ? latest.averageTenureYears.toFixed(1)
                  : null
              }
              unit="年"
              diffLabel={tenureDiff?.label}
              diffTone={tenureDiff?.tone}
              diffCaption="業界平均比"
            />
            <MetricCard
              label="従業員数"
              value={
                latest.employeeCount !== null
                  ? formatNumber(latest.employeeCount)
                  : null
              }
              unit="人"
              yoyLabel={employeesYoY?.label}
              yoyTone={employeesYoY?.tone}
            />
            <MetricCard
              label="平均年齢"
              value={
                latest.averageAge !== null ? latest.averageAge.toFixed(1) : null
              }
              unit="歳"
              diffLabel={ageDiff?.label}
              diffTone={ageDiff?.tone}
              diffCaption={`業界平均 ${ageBaseline}歳`}
            />
            <MetricCard
              label="女性管理職比率"
              value={
                latest.femaleManagerRatio !== null
                  ? formatPercent(latest.femaleManagerRatio)
                  : null
              }
              diffLabel={femaleManagerDiff?.label}
              diffTone={femaleManagerDiff?.tone}
              diffCaption={
                indNow?.avgFemaleManagerRatio
                  ? `業界平均 ${formatPercent(indNow.avgFemaleManagerRatio)}`
                  : undefined
              }
              unavailableLabel="任意開示項目"
            />
            <MetricCard
              label="平均残業時間（月）"
              value={
                latest.averageOvertimeHours !== null
                  ? `${latest.averageOvertimeHours.toFixed(1)}`
                  : null
              }
              unit="時間"
              diffLabel={overtimeDiff?.label}
              diffTone={overtimeDiff?.tone}
              diffCaption={
                indNow?.avgOvertimeHours
                  ? `業界平均 ${indNow.avgOvertimeHours.toFixed(1)}時間`
                  : undefined
              }
              unavailableLabel="任意開示項目"
            />
          </div>
        </section>

        {salaryTrend.length > 0 && (
          <section className="mt-8 rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
                  平均年収の推移
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  直近{salaryTrend.length}年。
                  {company.industryName ? `${company.industryName}業界平均（点線）と比較` : ""}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <SalaryTrendChart
                data={salaryTrend}
                companyName={company.name}
                industryName={company.industryName ?? "業界"}
              />
            </div>
            <details className="mt-4 text-base text-ink-muted">
              <summary className="cursor-pointer">数値データを表示</summary>
              <table className="mt-2 w-full border-collapse text-base">
                <thead>
                  <tr className="border-b border-surface-border text-left text-ink-muted">
                    <th className="py-1.5 font-medium">年度</th>
                    <th className="py-1.5 text-right font-medium">{company.name}</th>
                    <th className="py-1.5 text-right font-medium">業界平均</th>
                  </tr>
                </thead>
                <tbody className="font-numeric tabular-nums">
                  {salaryTrend.map((row) => (
                    <tr key={row.fiscalYear} className="border-b border-surface-border/60">
                      <td className="py-1.5">{row.fiscalYear}年度</td>
                      <td className="py-1.5 text-right">
                        {`${(row.companySalary / 10_000).toFixed(0)}万円`}
                      </td>
                      <td className="py-1.5 text-right text-ink-muted">
                        {`${(row.industrySalary / 10_000).toFixed(0)}万円`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
        )}

        {earningsTrend.length > 0 && (
          <section className="mt-8 rounded-2xl border border-surface-border bg-white px-3 py-4 sm:p-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
                  業績の推移
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  売上高・営業利益・経常利益（直近{earningsTrend.length}年）
                </p>
              </div>
            </div>
            <div className="mt-4">
              <EarningsTrendChart
                data={earningsTrend}
                brandColor={company.brandColor}
              />
            </div>
          </section>
        )}

        {positionEstimateAvailable && (
          <GatedPositionSalary
            edinetCode={company.edinetCode}
            fiscalYear={latest.fiscalYear}
            returnTo={`/companies/${company.edinetCode}`}
          />
        )}

        {mhlw && <MhlwSection data={mhlw} />}

        {peers.length > 0 && (
          <section className="mt-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
                  同業他社との比較
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {company.industryName ?? "同業界"}の他社をピックアップ
                </p>
              </div>
              {company.industryCode && (
                <Link
                  href={`/search?industry=${company.industryCode}`}
                  className="text-sm font-medium text-brand hover:text-brand-700"
                >
                  業界内をすべて見る →
                </Link>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {peers.map((p) => (
                <CompanyCard key={p.id} company={p} variant="compact" />
              ))}
            </div>
          </section>
        )}

        {latest.docId && (
          <section className="mt-8 rounded-2xl border border-surface-border bg-surface-muted p-6 sm:p-8">
            <h2 className="text-base font-semibold text-ink">データ出典</h2>
            <p className="mt-2 text-sm text-ink-muted">
              このページのデータは、{company.name}が
              {submittedDate
                ? new Intl.DateTimeFormat("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    year: "numeric",
                    month: "long",
                  }).format(submittedDate) + "に"
                : ""}
              金融庁EDINETへ提出した
              {latest.fiscalYear}年度の有価証券報告書（書類管理番号: {latest.docId}）から取得しています。
            </p>
            <p className="mt-2 text-base text-ink-subtle">
              ※平均年収は臨時雇用者を除いた数値です。記載がない指標は「データなし」と表示します。
            </p>
            <a
              href={`https://disclosure2.edinet-fsa.go.jp/WEEK0010.aspx?LinkType=2&Lcc=1&docID=${latest.docId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              EDINETで該当書類を見る
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
