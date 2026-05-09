/**
 * 決算期変更で fiscal_year が衝突し、変則期データに新通常期データが上書きされた7社を再処理する。
 * 各会社の最新通常期 docID から financial_metrics を再生成し、companies.latest_* も更新する。
 *
 * 一回限りの修正用スクリプト。daily.ts には submitted_at ガードが入ったので、今後は再発しない想定。
 */
import { fetchDocBinary, sleep } from "./lib/edinet";
import { supabaseAdmin } from "./lib/supabase";
import { extractFinancialFacts, parseXbrlCsvZip } from "./lib/xbrl";

// 各会社の「最新通常期」docID。これで上書きする。
const TARGETS: Array<{ edinetCode: string; docId: string; note: string }> = [
  { edinetCode: "E00545", docId: "S100V5TT", note: "マーチャント・バンカーズ 2023-11-01〜2024-10-31" },
  { edinetCode: "E01864", docId: "S100XHR9", note: "多摩川HD 2024-11-01〜2025-10-31" },
  { edinetCode: "E03044", docId: "S100SDXW", note: "さいか屋 2022-09-01〜2023-08-31" },
  { edinetCode: "E05481", docId: "S100SOO5", note: "日本テレホン 2022-11-01〜2023-10-31" },
  { edinetCode: "E27421", docId: "S100P9EO", note: "クロス・マーケティンググループ 2021-07-01〜2022-06-30" },
  { edinetCode: "E37159", docId: "S100V59D", note: "ラバブルマーケティンググループ 2023-11-01〜2024-10-31" },
  { edinetCode: "E39259", docId: "S100XBKO", note: "タスキHD 2024-10-01〜2025-09-30" },
];

async function main() {
  let ok = 0;
  let fail = 0;
  for (const t of TARGETS) {
    try {
      console.log(`[${t.edinetCode}] ${t.docId} ${t.note}`);

      // company_id を引く
      const { data: company, error: cErr } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("edinet_code", t.edinetCode)
        .single();
      if (cErr) throw cErr;

      // raw_xbrl_documents から submitted_at を引く
      const { data: raw, error: rErr } = await supabaseAdmin
        .from("raw_xbrl_documents")
        .select("submitted_at")
        .eq("doc_id", t.docId)
        .single();
      if (rErr) throw rErr;

      // type=5 CSV を取り直して再パース
      const csvZip = await fetchDocBinary(t.docId, 5);
      const facts = await parseXbrlCsvZip(csvZip);
      const fin = extractFinancialFacts(facts);
      if (!Number.isFinite(fin.fiscalYear)) {
        throw new Error(`fiscal_year extraction failed for ${t.docId}`);
      }

      console.log(
        `  → FY=${fin.fiscalYear} salary=${fin.averageAnnualSalary} employees=${fin.employeeCount} revenue=${fin.revenue}`
      );

      // 強制上書き(古い変則期データを正しい新通常期データに置き換える)
      const { error: fErr } = await supabaseAdmin
        .from("financial_metrics")
        .upsert(
          {
            company_id: company.id,
            fiscal_year: fin.fiscalYear,
            average_annual_salary: fin.averageAnnualSalary,
            average_age: fin.averageAge,
            average_tenure_years: fin.averageTenureYears,
            employee_count: fin.employeeCount,
            female_manager_ratio: fin.femaleManagerRatio,
            average_overtime_hours: fin.averageOvertimeHours,
            revenue: fin.revenue,
            operating_income: fin.operatingIncome,
            ordinary_income: fin.ordinaryIncome,
            net_income: fin.netIncome,
            doc_id: t.docId,
            submitted_at: raw.submitted_at,
          },
          { onConflict: "company_id,fiscal_year" }
        );
      if (fErr) throw fErr;
      ok++;
      await sleep(150);
    } catch (e) {
      console.error(`  FAIL ${t.docId}: ${e}`);
      fail++;
    }
  }

  console.log(`\n[reprocess] done ok=${ok} fail=${fail}`);

  // companies.latest_* を再計算
  console.log("[reprocess] refresh_company_latest_metrics() 実行");
  const { error: refErr } = await supabaseAdmin.rpc(
    "refresh_company_latest_metrics"
  );
  if (refErr) throw refErr;

  console.log("[reprocess] 完了");
}

main().catch((e) => {
  console.error("[reprocess] FATAL:", e);
  process.exit(1);
});
