import { Award, Building2 } from "lucide-react";
import type { MhlwCompanyData } from "@/lib/data/mhlw-types";
import { isCertified } from "@/lib/data/mhlw-types";
import { formatPercent } from "@/lib/utils";

type Props = {
  data: MhlwCompanyData;
};

const CERT_LABELS: Array<{ key: keyof MhlwCompanyData; label: string }> = [
  { key: "certPlatinumKurumin", label: "プラチナくるみん" },
  { key: "certKurumin", label: "くるみん" },
  { key: "certTryKurumin", label: "トライくるみん" },
  { key: "certKuruminPlus", label: "くるみんプラス" },
  { key: "certPlatinumEruboshi", label: "プラチナえるぼし" },
  { key: "certEruboshi", label: "えるぼし" },
  { key: "certYouthYell", label: "ユースエール" },
  { key: "certNadeshiko", label: "なでしこ銘柄" },
];

const SYSTEM_LABELS: Array<{ key: keyof MhlwCompanyData; label: string }> = [
  { key: "systemFlextime", label: "フレックスタイム" },
  { key: "systemTelework", label: "テレワーク・在宅勤務" },
  { key: "systemShortHours", label: "短時間勤務" },
  { key: "systemPaidLeaveHourly", label: "有給休暇の時間単位取得" },
  { key: "systemFertilityLeave", label: "病気・不妊治療休暇" },
  { key: "systemCareerChange", label: "職種・雇用形態の転換" },
  { key: "systemRehireMidcareer", label: "正社員再雇用・中途採用" },
  { key: "systemTraining", label: "教育訓練・研修" },
  { key: "systemCareerConsulting", label: "キャリアコンサルティング" },
];

export function MhlwSection({ data }: Props) {
  const certs = CERT_LABELS.filter((c) =>
    isCertified(data[c.key] as string | null)
  );
  const systems = SYSTEM_LABELS.filter((s) => Boolean(data[s.key]));

  return (
    <section className="mt-8 rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
            女性活躍・両立支援の取り組み
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            厚生労働省「女性の活躍推進企業データベース」に企業自身が公表した内容
          </p>
        </div>
        <Building2 className="h-5 w-5 text-ink-muted" aria-hidden />
      </div>

      {/* 数値メトリクス */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <SmallMetric
          label="月平均残業時間"
          value={
            data.avgOvertimeHours !== null
              ? `${data.avgOvertimeHours.toFixed(1)} 時間`
              : null
          }
          caption={data.overtimeTargetScope ?? undefined}
        />
        <SmallMetric
          label="有給休暇取得率"
          value={
            data.paidLeaveUptakePct !== null
              ? formatPercent(data.paidLeaveUptakePct)
              : null
          }
        />
        <SmallMetric
          label="育休取得率（女性）"
          value={
            data.parentalLeaveFemalePct !== null
              ? formatPercent(data.parentalLeaveFemalePct)
              : null
          }
        />
        <SmallMetric
          label="育休取得率（男性）"
          value={
            data.parentalLeaveMalePct !== null
              ? formatPercent(data.parentalLeaveMalePct)
              : null
          }
        />
        <SmallMetric
          label="女性管理職比率"
          value={
            data.femaleManagerRatio !== null
              ? formatPercent(data.femaleManagerRatio)
              : null
          }
          caption={
            data.femaleManagerCount !== null && data.managerTotalCount !== null
              ? `${data.femaleManagerCount}人 / ${data.managerTotalCount}人`
              : undefined
          }
        />
        <SmallMetric
          label="女性役員比率"
          value={
            data.femaleOfficerRatio !== null
              ? formatPercent(data.femaleOfficerRatio)
              : null
          }
          caption={
            data.femaleOfficerCount !== null && data.officerTotalCount !== null
              ? `${data.femaleOfficerCount}人 / ${data.officerTotalCount}人`
              : undefined
          }
        />
        <SmallMetric
          label="係長級女性比率"
          value={
            data.femaleChiefRatio !== null
              ? formatPercent(data.femaleChiefRatio)
              : null
          }
        />
        <SmallMetric
          label="男女の賃金差（全労働者）"
          value={
            data.payGapAllPct !== null
              ? formatPercent(data.payGapAllPct)
              : null
          }
          caption={
            data.payGapAllPct !== null ? "100%で同等" : undefined
          }
        />
      </div>

      {/* 賃金差 詳細 (正規/非正規別) */}
      {(data.payGapRegularPct !== null || data.payGapNonregularPct !== null) && (
        <div className="mt-4 rounded-xl border border-surface-border bg-surface-muted/60 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-ink">男女の賃金差・内訳</p>
            <p className="text-sm text-ink-subtle">100% で完全に同等</p>
          </div>

          <div className="mt-4 space-y-4">
            {data.payGapRegularPct !== null && (
              <PayGapRow label="正規雇用" pct={data.payGapRegularPct} />
            )}
            {data.payGapNonregularPct !== null && (
              <PayGapRow label="非正規雇用" pct={data.payGapNonregularPct} />
            )}
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink-subtle">
            ※女性 ÷ 男性 × 100 で算出。非正規（パート・契約等）は時給ベースが多くポジション差が出にくいため、正規より100%に近い値になりやすい傾向があります。賃金単価の差というより、社内の役職構成・勤続年数の差を映しています。
          </p>
        </div>
      )}

      {/* 認定 */}
      {certs.length > 0 && (
        <div className="mt-6">
          <p className="text-base font-semibold tracking-wider text-ink-muted">
            取得している認定・選定
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {certs.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-base font-semibold text-amber-700"
              >
                <Award className="h-3.5 w-3.5" aria-hidden />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 制度 */}
      {systems.length > 0 && (
        <div className="mt-6">
          <p className="text-base font-semibold tracking-wider text-ink-muted">
            実施している制度
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {systems.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-2 text-ink"
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600"
                />
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-base text-ink-subtle">
        ※
        {data.dataTargetScope ? `対象: ${data.dataTargetScope}・` : ""}
        {data.dataAggregationPoint ? `集計時点: ${data.dataAggregationPoint}・` : ""}
        {data.dataUpdatedAt ? `最終更新: ${data.dataUpdatedAt}・` : ""}
        出典: 厚生労働省「女性の活躍推進企業データベース」
      </p>
    </section>
  );
}

function SmallMetric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | null;
  caption?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-border bg-white p-3">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1 font-numeric text-lg font-bold tabular-nums text-ink">
        {value ?? <span className="text-ink-subtle">—</span>}
      </p>
      {caption && (
        <p className="mt-0.5 text-sm text-ink-subtle">{caption}</p>
      )}
    </div>
  );
}

function PayGapRow({ label, pct }: { label: string; pct: number }) {
  // 100% に近いほど緑、離れるほど琥珀色
  const distance = Math.abs(100 - pct);
  let barClass = "bg-positive";
  let textClass = "text-positive-600";
  if (distance > 25) {
    barClass = "bg-amber-500";
    textClass = "text-amber-700";
  } else if (distance > 10) {
    barClass = "bg-amber-400";
    textClass = "text-amber-700";
  }
  // バーの幅は 0〜100% にクランプ（>100% も表現できるよう Math.min で）
  const barWidth = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span
          className={`font-numeric text-2xl font-bold tabular-nums ${textClass}`}
        >
          {pct.toFixed(1)}
          <span className="ml-0.5 text-base font-medium">%</span>
        </span>
      </div>
      <div
        aria-hidden
        className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-surface-border/70"
      >
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${barWidth}%` }}
        />
        {/* 100% の目盛 */}
        <div className="absolute inset-y-0 right-0 w-px bg-ink/40" />
      </div>
      <div className="mt-1 flex justify-between text-sm text-ink-subtle">
        <span>0%（女性のみ無給）</span>
        <span>100%（同等）</span>
      </div>
    </div>
  );
}
