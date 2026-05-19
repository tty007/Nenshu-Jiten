import Link from "next/link";
import {
  Activity,
  Building2,
  Database,
  ExternalLink,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { MiniLineChart } from "@/components/admin/MiniLineChart";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { SparkBarChart } from "@/components/admin/SparkBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { TopMetricsChart } from "@/components/admin/TopMetricsChart";
import {
  buildContiguousDateAxis,
  getDailyMetrics,
} from "@/lib/admin/get-daily-metrics";
import {
  getDailyPageViewsLive,
  getPageViewSummary,
  getTopArticlesByViews,
  getTopCompaniesByViews,
  getTopPagesByPath,
} from "@/lib/admin/get-page-view-stats";
import {
  getCompanyStats,
  getDailySignups,
  getDataCompleteness,
  getEngagementStats,
  getEtlHealth,
  getRecentlyUpdatedCompanies,
  getUserSegmentStats,
  getUserStats,
} from "@/lib/admin/get-admin-stats";

export const metadata = { title: "ダッシュボード" };

const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATETIME.format(d);
}

const JST_DATE = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATE.format(d);
}

export default async function AdminDashboardPage() {
  const [
    users,
    signups,
    companies,
    etl,
    engagement,
    completeness,
    recents,
    segments,
    daily,
    livePv,
    pvSummary,
    topPaths,
    topViewedCompanies,
    topViewedArticles,
  ] = await Promise.all([
    getUserStats(),
    getDailySignups(30),
    getCompanyStats(),
    getEtlHealth(),
    getEngagementStats(),
    getDataCompleteness(),
    getRecentlyUpdatedCompanies(20),
    getUserSegmentStats(),
    getDailyMetrics(30),
    getDailyPageViewsLive(30),
    getPageViewSummary(30),
    getTopPagesByPath(30, 20),
    getTopCompaniesByViews(30, 10),
    getTopArticlesByViews(30, 10),
  ]);

  // 30 日間の固定日付軸を作り、daily_metrics（users 系）と
  // page_views 生集計（pageViews）をマージする。これで JST 03:00 の
  // スナップショット前でも「今日」の PV が出る。
  // usersTotal は累計値なので、daily_metrics の行が無い日（cron 前の今日や
  // 過去の欠損日）は前日の値を forward-fill する。0 に落とすと
  // 「累計が下がる」グラフになってしまうため。
  const dailyByDate = new Map(daily.map((d) => [d.date, d]));
  let carryUsersTotal = 0;
  const topChartData = buildContiguousDateAxis(30).map((date) => {
    const dm = dailyByDate.get(date);
    if (dm && dm.usersTotal > 0) carryUsersTotal = dm.usersTotal;
    return {
      date,
      usersNew: dm?.usersNew ?? 0,
      usersTotal: carryUsersTotal,
      pageViews: livePv.get(date) ?? dm?.pageViews ?? 0,
    };
  });
  // 末尾（今日）の累計は users.total（auth.users の現在値）と一致させる
  // ことで、スナップショット未生成でも最新の累計が反映される。
  if (topChartData.length > 0) {
    const last = topChartData[topChartData.length - 1];
    if (users.total > last.usersTotal) last.usersTotal = users.total;
  }

  const etlStaleHours = etl.lastIngestAt
    ? (Date.now() - Date.parse(etl.lastIngestAt)) / (60 * 60 * 1000)
    : Infinity;
  const etlTone =
    etlStaleHours <= 36
      ? "ok"
      : etlStaleHours <= 72
        ? "warning"
        : "danger";

  // 累計推移（cumulative line）を signups から作る
  const cumulativeSignups = (() => {
    const start = users.total - signups.reduce((s, d) => s + d.count, 0);
    let acc = start;
    return signups.map((d) => {
      acc += d.count;
      return { label: d.date, value: acc };
    });
  })();

  return (
    <section className="space-y-12">
      {/* PAGE HEADER */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-surface-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            管理画面 / ダッシュボード
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            運用サマリー
          </h1>
        </div>
        <p className="text-xs text-ink-muted">
          直近 30 日 / 計測時刻 {JST_DATETIME.format(new Date())}
        </p>
      </header>

      {/* TOP CONSOLIDATED CHART */}
      <section>
        <SectionHeader
          title="主要指標 30日推移"
          subtitle="新規ユーザー（バー） / 累計ユーザー・PV（線）。凡例で表示切替可。"
        />
        <Card className="mt-6">
          <TopMetricsChart data={topChartData} />
        </Card>
      </section>

      {/* PV SUMMARY + BREAKDOWNS */}
      <section>
        <SectionHeader
          title="ページビュー"
          subtitle="同意不要の自社内集計（path / date / count のみ・PII なし）"
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-4">
          <StatCard
            icon={Activity}
            label="本日 PV"
            value={pvSummary.totalToday}
            unit="件"
            hint={`過去7日 ${pvSummary.totalLast7d.toLocaleString("ja-JP")}`}
          />
          <StatCard
            icon={TrendingUp}
            label="過去30日 PV"
            value={pvSummary.totalLastNDays}
            unit="件"
            hint={`ユニークパス ${pvSummary.uniquePathsLastNDays}`}
          />
          <StatCard
            icon={Building2}
            label="企業ページ閲覧 TOP"
            value={
              topViewedCompanies[0]
                ? `${topViewedCompanies[0].count.toLocaleString("ja-JP")} 件`
                : "—"
            }
            hint={topViewedCompanies[0]?.name ?? "データなし"}
          />
          <StatCard
            icon={Sparkles}
            label="記事閲覧 TOP"
            value={
              topViewedArticles[0]
                ? `${topViewedArticles[0].count.toLocaleString("ja-JP")} 件`
                : "—"
            }
            hint={topViewedArticles[0]?.title ?? "データなし"}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card>
            <SectionHeader
              title="閲覧の多いパス TOP20"
              subtitle="過去30日 / page_views テーブル"
            />
            <div className="mt-4 max-h-80 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-border">
              {topPaths.length === 0 ? (
                <p className="text-sm text-ink-muted">まだ計測データがありません</p>
              ) : (
                <ol className="space-y-2.5">
                  {topPaths.map((p, i) => {
                    const max = topPaths[0].count;
                    const pctW = max > 0 ? (p.count / max) * 100 : 0;
                    return (
                      <li
                        key={p.path}
                        className="grid grid-cols-[1.5rem_1fr_3rem] items-center gap-2 text-xs"
                      >
                        <span className="font-numeric font-bold tabular-nums text-ink-muted">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate font-mono text-[11px] text-ink">
                            {p.path}
                          </span>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                            <span
                              aria-hidden
                              className="block h-full bg-gradient-to-r from-orange-400 to-orange-600"
                              style={{ width: `${pctW}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-right font-numeric font-bold tabular-nums text-ink">
                          {p.count.toLocaleString("ja-JP")}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="企業ページ閲覧 TOP10"
              subtitle="過去30日 / company_page_views"
            />
            <div className="mt-4 max-h-80 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-border">
              {topViewedCompanies.length === 0 ? (
                <p className="text-sm text-ink-muted">まだ計測データがありません</p>
              ) : (
                <ol className="space-y-2.5">
                  {topViewedCompanies.map((c, i) => {
                    const max = topViewedCompanies[0].count;
                    const pctW = max > 0 ? (c.count / max) * 100 : 0;
                    return (
                      <li
                        key={c.companyId}
                        className="grid grid-cols-[1.5rem_1fr_3rem] items-center gap-2 text-xs"
                      >
                        <span className="font-numeric font-bold tabular-nums text-ink-muted">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/companies/${c.edinetCode}`}
                            className="block truncate font-medium text-ink hover:text-brand-700"
                          >
                            {c.name}
                          </Link>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                            <span
                              aria-hidden
                              className="block h-full bg-gradient-to-r from-blue-500 to-blue-700"
                              style={{ width: `${pctW}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-right font-numeric font-bold tabular-nums text-ink">
                          {c.count.toLocaleString("ja-JP")}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="記事閲覧 TOP10"
              subtitle="過去30日 / article_page_views"
            />
            <div className="mt-4 max-h-80 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-border">
              {topViewedArticles.length === 0 ? (
                <p className="text-sm text-ink-muted">まだ計測データがありません</p>
              ) : (
                <ol className="space-y-2.5">
                  {topViewedArticles.map((a, i) => {
                    const max = topViewedArticles[0].count;
                    const pctW = max > 0 ? (a.count / max) * 100 : 0;
                    const href = `/articles/${a.slug ?? a.articleId}`;
                    return (
                      <li
                        key={a.articleId}
                        className="grid grid-cols-[1.5rem_1fr_3rem] items-center gap-2 text-xs"
                      >
                        <span className="font-numeric font-bold tabular-nums text-ink-muted">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={href}
                            className="block truncate font-medium text-ink hover:text-brand-700"
                          >
                            {a.title}
                          </Link>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                            <span
                              aria-hidden
                              className="block h-full bg-gradient-to-r from-purple-500 to-purple-700"
                              style={{ width: `${pctW}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-right font-numeric font-bold tabular-nums text-ink">
                          {a.count.toLocaleString("ja-JP")}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* TOP ROW: hero summary + 3 KPI */}
      <section className="grid gap-5 lg:grid-cols-4">
        {/* Hero summary card (dark) */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-sky-500 p-7 text-white shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            年収辞典
          </div>
          <p className="mt-3 text-sm text-white/80">サービス全体</p>
          <dl className="mt-4 space-y-3">
            <HeroStat label="累計ユーザー" value={`${users.total.toLocaleString("ja-JP")} 人`} />
            <HeroStat
              label="累計企業"
              value={`${companies.total.toLocaleString("ja-JP")} 社`}
            />
            <HeroStat
              label="累計お気に入り"
              value={`${engagement.totalFavorites.toLocaleString("ja-JP")} 件`}
            />
          </dl>
        </div>

        {/* User count + cumulative trend */}
        <StatCard
          icon={Users}
          label="累計ユーザー"
          value={users.total}
          unit="人"
          hint={`過去7日 +${users.newLast7d}`}
          trend={
            <MiniLineChart
              data={cumulativeSignups}
              ariaLabel="累計ユーザー数の推移"
            />
          }
        />

        {/* 24h Active */}
        <StatCard
          icon={Activity}
          label="24h アクティブ"
          value={users.activeLast24h}
          unit="人"
          hint={`過去30日: ${users.activeLast30d}`}
          trend={
            <SparkBarChart data={signups} ariaLabel="日別新規ユーザー数" />
          }
        />

        {/* Favorites */}
        <StatCard
          icon={Heart}
          label="累計お気に入り"
          value={engagement.totalFavorites}
          unit="件"
          hint={`1人あたり ${engagement.avgFavoritesPerUser.toFixed(2)} 件`}
        />
      </section>

      {/* SECOND ROW: company / data quality KPIs (4) */}
      <section>
        <SectionHeader title="コンテンツ・データ品質" />
        <div className="mt-6 grid gap-5 lg:grid-cols-4">
          <StatCard
            icon={Building2}
            label="累計企業"
            value={companies.total}
            unit="社"
            hint={`30日に更新 ${companies.recentlyUpdatedCount.toLocaleString("ja-JP")} 社`}
          />
          <StatCard
            icon={TrendingUp}
            label="平均年収あり"
            value={`${pct(companies.withSalary, companies.total)}%`}
            hint={`${companies.withSalary.toLocaleString("ja-JP")} / ${companies.total.toLocaleString("ja-JP")}`}
          />
          <StatCard
            icon={Sparkles}
            label="AI 概要あり"
            value={`${pct(companies.withSummary, companies.total)}%`}
            hint={`${companies.withSummary.toLocaleString("ja-JP")} / ${companies.total.toLocaleString("ja-JP")}`}
          />
          <StatCard
            icon={Database}
            label="gBizINFO 補完済"
            value={`${pct(companies.withGbizinfo, companies.total)}%`}
            hint={`${companies.withGbizinfo.toLocaleString("ja-JP")} / ${companies.total.toLocaleString("ja-JP")}`}
          />
        </div>
      </section>

      {/* USER SEGMENTS */}
      <section>
        <SectionHeader
          title="ユーザーセグメント"
          subtitle="プロフィール属性別の登録分布"
        />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SegmentCard title="都道府県 TOP10" rows={segments.byPrefecture} />
          <SegmentCard title="年収レンジ別" rows={segments.bySalaryBand} />
          <SegmentCard title="キャリアステータス" rows={segments.byCareerStatus} />
          <SegmentCard title="性別" rows={segments.byGender} />
        </div>
      </section>

      {/* ENGAGEMENT + RECENTS (2 col) */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader
            title="お気に入り TOP10"
            subtitle="ユーザーが登録した企業の人気順"
          />
          <div className="mt-6 max-h-72 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-border">
            {engagement.topCompanies.length === 0 ? (
              <p className="text-sm text-ink-muted">
                まだお気に入り登録がありません
              </p>
            ) : (
              <ol className="space-y-3">
                {engagement.topCompanies.map((c, i) => {
                  const max = engagement.topCompanies[0].count;
                  const pctW = max > 0 ? (c.count / max) * 100 : 0;
                  return (
                    <li
                      key={c.id}
                      className="grid grid-cols-[1.5rem_1fr_3rem] items-center gap-3"
                    >
                      <span className="font-numeric text-sm font-bold tabular-nums text-ink-muted">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/companies/${c.edinetCode}`}
                          className="block truncate text-sm font-medium text-ink hover:text-brand-700"
                        >
                          {c.name}
                        </Link>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <span
                            aria-hidden
                            className="block h-full bg-gradient-to-r from-rose-400 to-rose-600"
                            style={{ width: `${pctW}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-right font-numeric text-sm font-bold tabular-nums text-ink">
                        {c.count}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="直近更新企業"
            subtitle="latest_submitted_at 降順 / 上位 20 社"
          />
          <ul className="mt-6 max-h-72 divide-y divide-surface-border overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-border">
            {recents.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/companies/${c.edinetCode}`}
                    className="block truncate font-medium text-ink hover:text-brand-700"
                  >
                    {c.name}
                  </Link>
                  <span className="text-xs text-ink-muted">
                    {c.industryName ?? c.edinetCode}
                  </span>
                </div>
                <span className="shrink-0 font-numeric text-xs tabular-nums text-ink-muted">
                  {fmtDate(c.latestSubmittedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* DATA COMPLETENESS - full row of progress bars */}
      <section>
        <SectionHeader
          title="データ充足率"
          subtitle="主要カラムの NOT NULL 比率（全企業ベース）"
        />
        <Card className="mt-6">
          <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {completeness.rows.map((r) => (
              <ProgressBar
                key={r.key}
                label={r.label}
                count={r.count}
                total={completeness.total}
              />
            ))}
          </div>
        </Card>
      </section>

      {/* ETL HEALTH */}
      <section>
        <SectionHeader title="ETL 健全性" subtitle="EDINET 取込ジョブの直近の動き" />
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <StatCard
            icon={Database}
            label="最終取込"
            value={fmtDateTime(etl.lastIngestAt)}
            tone={etlTone}
            hint={
              etl.lastIngestDocId ? `doc: ${etl.lastIngestDocId}` : undefined
            }
          />
          <StatCard
            icon={Database}
            label="直近 7 日 取込件数"
            value={etl.parsedLast7d}
            unit="件"
          />
          <StatCard
            icon={Database}
            label="直近 30 日 パースエラー"
            value={etl.parseErrorsLast30d}
            unit="件"
            tone={etl.parseErrorsLast30d > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      {/* USER ENGAGEMENT NAV */}
      <section>
        <SectionHeader title="詳細" />
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-brand-100 hover:text-brand-700"
          >
            ユーザー一覧へ →
          </Link>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-brand-100 hover:text-brand-700"
          >
            Vercel Analytics で詳細を見る
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </section>
    </section>
  );
}

function pct(part: number, total: number): string {
  if (!total) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-bold text-ink sm:text-lg">{title}</h2>
      {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
    </div>
  );
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-surface-border bg-white p-6 sm:p-7 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-white/70">{label}</dt>
      <dd className="font-numeric text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function SegmentCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-surface-border bg-white p-6 sm:p-7">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-ink-subtle">データなし</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => {
            const max = rows[0].count;
            const pctW = max > 0 ? (r.count / max) * 100 : 0;
            return (
              <li
                key={r.label}
                className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-2 text-xs"
              >
                <span className="truncate text-ink-muted">{r.label}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    aria-hidden
                    className="block h-full bg-gradient-to-r from-blue-700 to-sky-400"
                    style={{ width: `${pctW}%` }}
                  />
                </div>
                <span className="text-right font-numeric tabular-nums text-ink">
                  {r.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-auto pt-3 text-right text-[11px] text-ink-subtle">
        計 {total.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}
