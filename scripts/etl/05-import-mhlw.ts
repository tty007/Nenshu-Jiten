/**
 * 05: 厚労省「女性の活躍推進企業データベース」CSV から、
 *     当社で取り扱っている企業の項目を抽出して
 *       - companies.corporate_number を埋める
 *       - mhlw_company_data に upsert
 *       - financial_metrics の最新年度の overtime / female_manager_ratio を補完（NULL のときのみ）
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import { supabaseAdmin } from "./lib/supabase";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");
const MHLW_CSV = path.resolve(
  process.cwd(),
  "lib/company-db/99_20260421_utf8_bom.csv"
);

type EdinetMap = Record<
  string,
  { name: string; corporate_number: string }
>;

function n(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t === "－" || t === "-" || t === "*") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function i(s: string | undefined): number | null {
  const v = n(s);
  return v === null ? null : Math.round(v);
}

function t(s: string | undefined): string | null {
  if (!s) return null;
  const v = s.trim();
  return v ? v : null;
}

function parseDate(s: string | undefined): string | null {
  // "2025年10月30日" -> "2025-10-30"
  if (!s) return null;
  const m = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

async function main() {
  const edinetMap: EdinetMap = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "edinet-corporate-numbers.json"), "utf8")
  );
  const corpToEdinet = new Map<string, string>();
  for (const [ec, v] of Object.entries(edinetMap)) {
    if (v.corporate_number) corpToEdinet.set(v.corporate_number, ec);
  }
  console.log(`target corporate_numbers: ${corpToEdinet.size}`);

  // 1) Update companies.corporate_number for our 48 companies
  for (const [ec, v] of Object.entries(edinetMap)) {
    if (!v.corporate_number) continue;
    await supabaseAdmin
      .from("companies")
      .update({ corporate_number: v.corporate_number })
      .eq("edinet_code", ec);
  }
  console.log("backfilled companies.corporate_number");

  // 2) Read MHLW CSV and find matched rows
  console.log("reading MHLW CSV (~85MB)...");
  const text = await fs.readFile(MHLW_CSV, "utf8");
  const rows = parseCsv(text, {
    columns: true,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  console.log(`MHLW rows: ${rows.length}`);

  const matches: Array<{ ec: string; row: Record<string, string> }> = [];
  for (const row of rows) {
    const cn = (row["法人番号"] ?? "").trim();
    const ec = corpToEdinet.get(cn);
    if (ec) matches.push({ ec, row });
  }
  console.log(`matched companies: ${matches.length}`);

  // 3) For each match: lookup company_id, upsert mhlw_company_data, supplement financial_metrics
  let upserted = 0;
  let supplementedOvertime = 0;
  let supplementedFemaleMgr = 0;
  for (const { ec, row } of matches) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("edinet_code", ec)
      .maybeSingle();
    if (!company) continue;

    const data = {
      company_id: company.id,
      corporate_number: row["法人番号"].trim(),
      source_company_name: t(row["企業名"]),

      avg_overtime_hours: n(row["6.一月当たりの労働者の平均残業時間-平均残業時間(時間)"]),
      overtime_target_scope: t(row["6.一月当たりの労働者の平均残業時間-公表する範囲"]),

      parental_leave_male_pct: n(row["5.男女別の育児休業取得率-男性(%)"]),
      parental_leave_female_pct: n(row["5.男女別の育児休業取得率-女性(%)"]),

      paid_leave_uptake_pct: n(row["8.(1)年次有給休暇の取得率-対象労働者(%)"]),

      female_chief_ratio: n(row["9.係長級にある者に占める女性労働者の割合-割合(%)"]),
      female_manager_ratio: n(row["10.管理職に占める女性労働者の割合-割合(%)"]),
      female_manager_count: i(row["10.管理職に占める女性労働者の割合-人数(人)"]),
      manager_total_count: i(row["10.管理職に占める女性労働者の割合-男女計(人)"]),
      female_officer_ratio: n(row["11.役員に占める女性の割合-割合(%)"]),
      female_officer_count: i(row["11.役員に占める女性の割合-人数(人)"]),
      officer_total_count: i(row["11.役員に占める女性の割合-男女計(人)"]),

      pay_gap_all_pct: n(row["14.男女の賃金の差異1-全労働者(%)"]),
      pay_gap_regular_pct: n(row["14.男女の賃金の差異2-うち正規雇用労働者(%)"]),
      pay_gap_nonregular_pct: n(row["14.男女の賃金の差異3-うち非正規雇用労働者(%)"]),

      cert_kurumin: t(row["企業認定等-くるみん認定"]),
      cert_kurumin_plus: t(row["企業認定等-くるみんプラス認定"]),
      cert_try_kurumin: t(row["企業認定等-トライくるみん認定"]),
      cert_platinum_kurumin: t(row["企業認定等-プラチナくるみん認定"]),
      cert_eruboshi: t(row["企業認定等-えるぼし認定"]),
      cert_platinum_eruboshi: t(row["企業認定等-プラチナえるぼし認定"]),
      cert_youth_yell: t(row["企業認定等-ユースエール認定"]),
      cert_nadeshiko: t(row["企業認定等-令和7年度なでしこ銘柄"]),

      system_career_change: t(row["職種・雇用形態転換制度"]),
      system_rehire_midcareer: t(row["正社員再雇用・中途採用制度"]),
      system_training: t(row["教育訓練・研修制度"]),
      system_career_consulting: t(row["キャリアコンサルティング制度"]),
      system_flextime: t(row["フレックスタイム制度"]),
      system_telework: t(row["在宅勤務・テレワーク"]),
      system_short_hours: t(row["短時間勤務制度"]),
      system_fertility_leave: t(row["病気・不妊治療休暇"]),
      system_paid_leave_hourly: t(row["年次有給休暇時間単位取得制度"]),

      data_target_period: t(row["14.対象期間"]),
      data_aggregation_point: t(row["16.データ集計時点-データ集計時点"]),
      data_target_scope: t(row["15.データの対象-データの対象"]),
      data_updated_at: parseDate(row["データの最終更新日"]),
    };

    const { error: upErr } = await supabaseAdmin
      .from("mhlw_company_data")
      .upsert(data, { onConflict: "company_id" });
    if (upErr) {
      console.error(`  ${ec} upsert failed:`, upErr.message);
      continue;
    }
    upserted++;

    // Supplement financial_metrics latest fiscal_year row
    const { data: latestMetric } = await supabaseAdmin
      .from("financial_metrics")
      .select("fiscal_year, average_overtime_hours, female_manager_ratio")
      .eq("company_id", company.id)
      .order("fiscal_year", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMetric) {
      const patch: Record<string, number> = {};
      if (
        latestMetric.average_overtime_hours === null &&
        data.avg_overtime_hours !== null
      ) {
        patch.average_overtime_hours = data.avg_overtime_hours;
        supplementedOvertime++;
      }
      if (
        latestMetric.female_manager_ratio === null &&
        data.female_manager_ratio !== null
      ) {
        patch.female_manager_ratio = data.female_manager_ratio;
        supplementedFemaleMgr++;
      }
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin
          .from("financial_metrics")
          .update(patch)
          .eq("company_id", company.id)
          .eq("fiscal_year", latestMetric.fiscal_year);
      }
    }
  }

  console.log(`\nupserted mhlw_company_data: ${upserted}`);
  console.log(`supplemented financial_metrics overtime: ${supplementedOvertime}`);
  console.log(`supplemented financial_metrics female_mgr: ${supplementedFemaleMgr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
