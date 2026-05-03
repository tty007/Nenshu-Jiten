/**
 * 07: gBizINFO（経済産業省 法人情報 API）から
 *     companies の基本情報（corporate_number / founded_at / website_url /
 *     capital_stock_yen / representative）を取得・上書きする。
 *
 * 法人番号の解決:
 *   - 既に companies.corporate_number があればそれを使う
 *   - 無ければ name で検索し、住所先頭一致（都道府県）で best-match を採用
 *
 * 引数:
 *   --limit N    : 取得対象を最大 N 件に絞る（テスト用）
 *   --refresh    : corporate_number 既知でも再取得して上書き
 *   --concurrency K : API 並列度（既定 1。レート制限注意）
 */
import { supabaseAdmin } from "./lib/supabase";
import {
  fetchByCorporateNumber,
  searchByName,
  type GBizInfoCompany,
} from "./lib/gbizinfo";

type CompanyRow = {
  id: string;
  edinet_code: string;
  name: string;
  headquarters: string | null;
  corporate_number: string | null;
  founded_at: string | null;
  website_url: string | null;
  capital_stock_yen: number | null;
  representative: string | null;
};

function parseArgs(): { limit: number | null; refresh: boolean; concurrency: number } {
  const a = process.argv.slice(2);
  let limit: number | null = null;
  let refresh = false;
  let concurrency = 1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--limit") limit = Number(a[++i]);
    else if (a[i] === "--refresh") refresh = true;
    else if (a[i] === "--concurrency") concurrency = Number(a[++i]);
  }
  return { limit, refresh, concurrency };
}

// 住所先頭の都道府県一致で best-match を選ぶ。
function pickBestByPrefecture(
  candidates: GBizInfoCompany[],
  ourHeadquarters: string | null
): GBizInfoCompany | null {
  if (candidates.length === 0) return null;
  if (!ourHeadquarters) return candidates[0];
  const ourPref = ourHeadquarters.match(
    /^(北海道|.{2,3}[都道府県])/
  )?.[1];
  if (!ourPref) return candidates[0];
  const same = candidates.find((c) => c.location?.startsWith(ourPref));
  return same ?? candidates[0];
}

async function fetchAllCompanies(): Promise<CompanyRow[]> {
  const all: CompanyRow[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select(
        "id, edinet_code, name, headquarters, corporate_number, founded_at, website_url, capital_stock_yen, representative"
      )
      .order("edinet_code")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as CompanyRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function deriveYear(date: string | null): number | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date);
  return m ? Number(m[1]) : null;
}

async function processCompany(
  c: CompanyRow,
  refresh: boolean
): Promise<"updated" | "no_match" | "skipped" | "error"> {
  // 1) 法人番号の解決：既に DB にあればそれを使い、無ければ名称検索で決定
  let cn = c.corporate_number;
  if (!cn) {
    const candidates = await searchByName(c.name, 10);
    const best = pickBestByPrefecture(candidates, c.headquarters);
    cn = best?.corporateNumber ?? null;
  }
  if (!cn) return "no_match";

  // 2) 確定した法人番号で詳細フェッチ（検索結果は項目が少ないので必ず by-CN で取り直す）
  const info = await fetchByCorporateNumber(cn);
  if (!info) return "no_match";

  // 2) 差分カラムを upsert（既に値がある場合は refresh フラグで判定）
  const update: Partial<CompanyRow> & { founded_year?: number | null } = {};
  if (refresh || !c.corporate_number) update.corporate_number = cn;
  if (refresh || !c.founded_at) update.founded_at = info.foundedAt ?? null;
  if (refresh || !c.website_url) update.website_url = info.websiteUrl ?? null;
  if (refresh || !c.capital_stock_yen)
    update.capital_stock_yen = info.capitalStockYen ?? null;
  if ((refresh || !c.representative) && info.representative) {
    update.representative = info.representative;
  }
  // 互換のため founded_year も派生して入れておく
  const fy = deriveYear(info.foundedAt ?? null);
  if (fy && (refresh || !c.founded_at)) update.founded_year = fy;

  // gBizINFO の by-CN レスポンスは法人番号自体は確実に返るが、それ以外
  // のカラムが空のままだと "更新項目なし" のことがある。
  // この場合でも corporate_number だけは保存しておきたい。
  if (Object.keys(update).length === 0) {
    if (!c.corporate_number) update.corporate_number = cn;
    else return "skipped";
  }

  const { error } = await supabaseAdmin
    .from("companies")
    .update(update)
    .eq("id", c.id);
  if (error) {
    console.error(`update failed for ${c.edinet_code}:`, error.message);
    return "error";
  }
  return "updated";
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { limit, refresh, concurrency } = parseArgs();
  const all = await fetchAllCompanies();
  // 既に主要 4 項目（corporate_number / founded_at / website_url / capital_stock_yen）
  // が全て入っていて --refresh も無いものはスキップ対象
  const targets = all.filter((c) => {
    if (refresh) return true;
    return !(
      c.corporate_number &&
      c.founded_at &&
      c.website_url &&
      c.capital_stock_yen
    );
  });
  const slice = limit !== null ? targets.slice(0, limit) : targets;
  console.log(
    `gBizINFO: total=${all.length} need_update=${targets.length} processing=${slice.length}`
  );

  const stats = { updated: 0, no_match: 0, skipped: 0, error: 0 };
  let i = 0;
  // シリアル or 並列。レート制限を考えて既定は serial（concurrency=1）。
  async function worker() {
    while (i < slice.length) {
      const idx = i++;
      const c = slice[idx];
      try {
        const r = await processCompany(c, refresh);
        stats[r]++;
        if ((idx + 1) % 50 === 0) {
          console.log(
            `[${idx + 1}/${slice.length}] updated=${stats.updated} no_match=${stats.no_match} skipped=${stats.skipped} error=${stats.error}`
          );
        }
      } catch (e) {
        stats.error++;
        console.error(`error for ${c.edinet_code}:`, (e as Error).message);
      }
      // 軽いスロットリング
      await sleep(100);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log("done", stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
