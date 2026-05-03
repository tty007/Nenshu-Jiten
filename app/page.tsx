import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Database,
  FileText,
  Layers,
  RefreshCw,
} from "lucide-react";
import { CompanyCard } from "@/components/CompanyCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import {
  HomeRankingTabs,
  type RankingItem,
  type RankingTabKey,
} from "@/components/HomeRankingTabs";
import { MarqueeRow } from "@/components/MarqueeRow";
import { SearchBox } from "@/components/SearchBox";
import {
  getAllIndustries,
  getRecentCompanies,
  searchCompaniesPaged,
} from "@/lib/data/companies";
import { getHomeStats, getSalaryDistribution } from "@/lib/data/home-stats";
import type { SalaryBucket } from "@/lib/data/home-stats";
import type { CompanyWithLatestMetrics } from "@/types";
import { formatNumber, formatSalary, formatYen } from "@/lib/utils";

export const revalidate = 3600;

const heroBullets = [
  "上場企業の有価証券報告書をすべて収録",
  "平均年収・勤続年数・働き方を一目で",
  "業界平均と簡単に比較できる",
];

const useCases = [
  {
    image: "/illustrations/use-research.png",
    title: "転職先を比較したい",
    description:
      "気になる会社の年収・働き方の指標を、業界平均と並べて確認できます。",
  },
  {
    image: "/illustrations/use-growth.png",
    title: "企業研究を効率化",
    description:
      "売上・従業員数・年収の推移を時系列のチャートで把握できます。",
  },
  {
    image: "/illustrations/use-community.png",
    title: "キャリアの相場感を知る",
    description:
      "役職別の推定年収や、業界内のランキングから自分の市場価値を確認。",
  },
];

export default async function HomePage() {
  const [
    featured,
    industries,
    stats,
    topSalary,
    topTenure,
    topEmployees,
    topRevenue,
    topRecent,
    salaryDist,
  ] = await Promise.all([
    getRecentCompanies(30),
    getAllIndustries(),
    getHomeStats(),
    searchCompaniesPaged({ sort: "salary", page: 1, pageSize: 5 }),
    searchCompaniesPaged({ sort: "tenure", page: 1, pageSize: 5 }),
    searchCompaniesPaged({ sort: "employees", page: 1, pageSize: 5 }),
    searchCompaniesPaged({ sort: "revenue", page: 1, pageSize: 5 }),
    searchCompaniesPaged({ sort: "recent", page: 1, pageSize: 5 }),
    getSalaryDistribution(),
  ]);
  const rankingData: Record<RankingTabKey, RankingItem[]> = {
    salary: toRankingItems(topSalary.items, (c) =>
      c.latest.averageAnnualSalary !== null
        ? formatSalary(c.latest.averageAnnualSalary)
        : "-"
    ),
    tenure: toRankingItems(topTenure.items, (c) =>
      c.latest.averageTenureYears !== null
        ? `${c.latest.averageTenureYears.toFixed(1)}年`
        : "-"
    ),
    employees: toRankingItems(topEmployees.items, (c) =>
      c.latest.employeeCount !== null
        ? `${formatNumber(c.latest.employeeCount)}人`
        : "-"
    ),
    revenue: toRankingItems(topRevenue.items, (c) => {
      const v = c.latest.revenue;
      if (v === null) return "-";
      if (v >= 100_000_000) {
        return `${Math.round(v / 100_000_000).toLocaleString("ja-JP")}億円`;
      }
      return formatYen(v);
    }),
    recent: toRankingItems(topRecent.items, (c) =>
      c.latest.submittedAt ? formatDate(c.latest.submittedAt) : "-"
    ),
  };

  return (
    <>
      <Header showSearch={false} />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-surface-border bg-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.10),_transparent_55%)]"
          />
          {/* モバイル: イラストを薄く背景化 */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-[-5%] top-4 h-48 w-1/2 opacity-15 sm:h-64 lg:hidden"
          >
            <Image
              src="/illustrations/hero.png"
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 50vw, 0px"
              className="object-contain object-right-top"
            />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:px-8">
            <div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl sm:leading-tight">
                <span className="bg-gradient-to-r from-blue-700 to-sky-400 bg-clip-text text-transparent">
                  有価証券報告書
                </span>
                から見る、
                <br className="hidden sm:block" />
                企業のリアルな数字。
              </h1>
              <ul className="mt-6 space-y-2 text-sm text-ink sm:text-base">
                {heroBullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <SearchBox />
                <p className="mt-3 text-sm text-ink-subtle">
                  例：「積水ハウス」「2217」「ダイドー」
                </p>
              </div>
            </div>
            {/* デスクトップ: 横並びのイラスト */}
            <div className="relative mx-auto hidden w-full max-w-sm lg:block lg:max-w-md">
              <Image
                src="/illustrations/hero.png"
                alt=""
                width={560}
                height={560}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* KPI stats */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              数字でわかる年収辞典
            </h2>
            <p className="hidden text-sm text-ink-muted sm:block">
              金融庁 EDINET の最新有報を自動取得・解析
            </p>
          </div>
          <div className="mt-6 grid gap-y-6 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-surface-border">
            <KpiCard
              icon={Building2}
              label="収録社数"
              value={formatNumber(stats.companyCount)}
              unit="社"
            />
            <KpiCard
              icon={Layers}
              label="業界数"
              value={formatNumber(stats.industryCount)}
              unit="業種"
            />
            <KpiCard
              icon={FileText}
              label="財務指標レコード数"
              value={formatNumber(stats.metricsCount)}
              unit="件"
            />
            <KpiCard
              icon={RefreshCw}
              label="最終更新日"
              value={formatDate(stats.latestUpdate)}
              unit=""
            />
          </div>
          </div>
        </section>

        {/* Popular ranking */}
        <section className="border-y border-surface-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                人気のランキング
              </h2>
              <Link
                href="/search?sort=salary"
                className="hidden text-sm font-medium text-brand hover:text-brand-700 sm:inline-flex sm:items-center sm:gap-1"
              >
                すべて見る
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <HomeRankingTabs data={rankingData} />
          </div>
        </section>

        {/* Salary distribution */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            平均年収の分布
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            上場企業全社の平均年収を 100 万円刻みで集計
          </p>
          <div className="mt-6 pr-2 sm:pr-4">
            <SalaryDistributionChart
              buckets={salaryDist.buckets}
              averageYen={salaryDist.averageYen}
            />
          </div>
        </section>

        {/* Use cases */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              こんなときに使われています
            </h2>
            <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {useCases.map((u) => (
                <div key={u.title}>
                  <div className="flex h-32 items-center justify-center sm:h-36">
                    <Image
                      src={u.image}
                      alt=""
                      width={400}
                      height={400}
                      className="h-full w-auto object-contain"
                    />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">
                    {u.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {u.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured / recent companies */}
        <section className="border-t border-surface-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  新着・注目の企業
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  直近で有価証券報告書が更新された企業
                </p>
              </div>
              <Link
                href="/search"
                className="hidden text-sm font-medium text-brand hover:text-brand-700 sm:inline-flex sm:items-center sm:gap-1"
              >
                すべて見る
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-6">
              <MarqueeRow>
                {featured.map((c) => (
                  <div key={c.id} className="w-80 shrink-0">
                    <CompanyCard company={c} />
                  </div>
                ))}
              </MarqueeRow>
            </div>
          </div>
        </section>

        {/* Industries */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            業界から探す
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            業界平均と比較しながら企業を見ていきましょう
          </p>
          <ul className="mt-6 divide-y divide-surface-border border-y border-surface-border sm:grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 sm:border-0 lg:grid-cols-3">
            {industries.map((ind) => (
              <li
                key={ind.code}
                className="sm:border-b sm:border-surface-border"
              >
                <Link
                  href={`/search?industry=${ind.code}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm font-medium text-ink transition hover:text-brand-700"
                >
                  <span>{ind.name}</span>
                  <ArrowRight className="h-4 w-4 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-surface-border bg-gradient-to-br from-brand-50 to-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-12 text-center sm:px-6 sm:py-16 lg:flex-row lg:justify-between lg:gap-8 lg:text-left lg:px-8">
            <div className="flex items-center gap-4">
              <Database
                className="hidden h-10 w-10 text-brand-600 sm:block"
                aria-hidden
              />
              <div>
                <h2 className="text-xl font-bold text-ink sm:text-2xl">
                  すべてのデータを無料でチェック
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  会員登録すると役職別の推定年収などの追加情報も見られます。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 lg:shrink-0">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                無料で会員登録
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-blue-700 to-sky-400 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-blue-800 hover:to-sky-500"
              >
                企業を検索する
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="px-2 py-2 sm:px-6 sm:py-4 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted sm:text-base">
        <Icon className="h-5 w-5 text-brand-600" aria-hidden />
        {label}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5 sm:mt-4">
        <span className="bg-gradient-to-r from-blue-700 to-sky-400 bg-clip-text font-numeric text-3xl font-bold tabular-nums text-transparent sm:text-4xl">
          {value}
        </span>
        {unit && (
          <span className="text-base font-medium text-ink-muted sm:text-lg">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function toRankingItems(
  items: CompanyWithLatestMetrics[],
  toLabel: (c: CompanyWithLatestMetrics) => string
): RankingItem[] {
  return items.map((c) => ({
    id: c.id,
    edinetCode: c.edinetCode,
    name: c.name,
    valueLabel: toLabel(c),
  }));
}

function SalaryDistributionChart({
  buckets,
  averageYen,
}: {
  buckets: SalaryBucket[];
  averageYen: number | null;
}) {
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1;
  const avgBucketIndex = averageYen
    ? buckets.findIndex(
        (b) => averageYen >= b.min && (b.max === null || averageYen < b.max)
      )
    : -1;
  return (
    <div>
      {averageYen !== null && (
        <p className="mb-6 flex items-baseline gap-2 font-numeric tabular-nums">
          <span className="text-base font-medium text-ink-muted sm:text-lg">
            全体の平均
          </span>
          <span className="bg-gradient-to-r from-blue-700 to-sky-400 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            {Math.round(averageYen / 10_000)}
          </span>
          <span className="text-base font-semibold text-ink-muted sm:text-lg">
            万円
          </span>
        </p>
      )}
      <ul className="space-y-3">
        {buckets.map((b, i) => {
          const w = Math.max(2, Math.round((b.count / maxCount) * 100));
          const isAvg = i === avgBucketIndex;
          return (
            <li
              key={b.key}
              className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-xs sm:gap-3 sm:text-sm"
            >
              <span
                className={`text-right ${
                  isAvg ? "font-semibold text-brand-700" : "text-ink-muted"
                }`}
              >
                {b.label}
              </span>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
                <span
                  aria-hidden
                  className={`block h-full rounded-full bg-gradient-to-r ${
                    isAvg
                      ? "from-blue-700 to-sky-400"
                      : "from-blue-200 to-sky-200"
                  }`}
                  style={{ width: `${w}%` }}
                />
              </div>
              <span
                className={`text-right font-numeric tabular-nums ${
                  isAvg ? "font-bold text-brand-700" : "text-ink-muted"
                }`}
              >
                {b.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
