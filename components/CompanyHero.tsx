import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  MapPin,
  Minus,
} from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { IndustryBadge, MarketBadge } from "@/components/IndustryBadge";
import { formatSalary } from "@/lib/utils";
import type { CompanyWithLatestMetrics } from "@/types";

type Tone = "positive" | "negative" | "neutral";

type Diff = { label: string; tone: Tone } | null;

type Props = {
  company: CompanyWithLatestMetrics;
  salaryIndustryDiff: Diff;
  salaryYoY: Diff;
  industryRank: { rank: number; total: number };
  isFavorited: boolean;
};

const toneTextClass: Record<Tone, string> = {
  positive: "text-emerald-200",
  negative: "text-amber-200",
  neutral: "text-white/70",
};

function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === "positive") return <ArrowUpRight className={className} aria-hidden />;
  if (tone === "negative") return <ArrowDownRight className={className} aria-hidden />;
  return <Minus className={className} aria-hidden />;
}

export function CompanyHero({
  company,
  salaryIndustryDiff,
  salaryYoY,
  industryRank,
  isFavorited,
}: Props) {
  const { brandColor, latest, coverImageUrl } = company;

  return (
    <section
      aria-label="企業ヘッダー"
      className="relative overflow-hidden rounded-2xl shadow-sm"
      style={{
        background: brandColor.to,
        color: brandColor.onPrimary,
      }}
    >
      {coverImageUrl && (
        <div className="absolute inset-x-0 top-0 h-72 sm:h-80" aria-hidden>
          <Image
            src={coverImageUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover object-top opacity-30"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${brandColor.from}99 0%, ${brandColor.to} 100%)`,
            }}
          />
        </div>
      )}

      <div className="relative px-6 py-7 sm:px-10 sm:py-10">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <FavoriteButton
            companyId={company.id}
            edinetCode={company.edinetCode}
            initialIsFavorited={isFavorited}
            variant="hero"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pr-32 sm:pr-36">
          <IndustryBadge name={company.industryName} className="bg-white/90" />
          <MarketBadge market={company.listedMarket} className="bg-white/90" />
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {company.name}
        </h1>
        {company.nameKana && (
          <p className="mt-0.5 text-base text-white/70">{company.nameKana}</p>
        )}
        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-base text-white/80">
          {company.securitiesCode && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/60">証券コード</span>
              <span className="font-numeric font-medium tabular-nums text-white">
                {company.securitiesCode}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-white/60">EDINET</span>
            <span className="font-numeric font-medium tabular-nums text-white">
              {company.edinetCode}
            </span>
          </div>
          {company.headquarters && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 opacity-70" aria-hidden />
              {company.headquarters}
            </div>
          )}
          {company.foundedYear && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/60">設立</span>
              <span className="font-numeric tabular-nums">
                {company.foundedYear}年
              </span>
            </div>
          )}
          {company.websiteUrl && (
            <Link
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-white underline-offset-2 hover:underline"
            >
              公式サイト
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </dl>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <p className="text-base font-semibold uppercase tracking-[0.18em] text-white/70">
              {latest.fiscalYear}年度 平均年収
            </p>
            <p className="mt-2 font-numeric text-6xl font-bold leading-none tracking-tight tabular-nums sm:text-7xl">
              {latest.averageAnnualSalary !== null
                ? formatSalary(latest.averageAnnualSalary)
                : "—"}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {salaryIndustryDiff && (
                <DiffPill
                  label={`業界平均比 ${salaryIndustryDiff.label}`}
                  tone={salaryIndustryDiff.tone}
                />
              )}
              {salaryYoY && (
                <DiffPill
                  label={`前年比 ${salaryYoY.label}`}
                  tone={salaryYoY.tone}
                />
              )}
            </div>
            <p className="mt-3 max-w-md text-base text-white/70">
              ※有価証券報告書「従業員の状況」より。臨時雇用者は除く。
            </p>
          </div>

          {industryRank.total > 1 && company.industryName && (
            <div className="flex flex-col items-start gap-1 rounded-xl bg-white/10 px-5 py-4 backdrop-blur-sm lg:items-end lg:text-right">
              <p className="text-sm font-medium uppercase tracking-wider text-white/80">
                {company.industryName} 業界内ランキング
              </p>
              <p className="font-numeric text-3xl font-bold tabular-nums">
                {industryRank.rank}
                <span className="ml-1 text-base font-medium text-white/80">
                  / {industryRank.total}社
                </span>
              </p>
              <p className="text-sm text-white/70">
                平均年収順
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DiffPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur-sm " +
        toneTextClass[tone]
      }
    >
      <ToneIcon tone={tone} className="h-3.5 w-3.5" />
      <span className="font-numeric tabular-nums">{label}</span>
    </span>
  );
}
