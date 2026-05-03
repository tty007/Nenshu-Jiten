/**
 * gBizINFO（経済産業省 法人情報 API）クライアント。
 * 仕様: https://info.gbiz.go.jp/api/index.html
 *
 * 認証: ヘッダ `X-hojinInfo-api-token: <token>`（無料の利用登録で取得）
 * 主な使い道:
 *   - 法人番号 → 詳細情報（設立年月日 / HP / 資本金 / 代表者 等）
 *   - 法人名 → 法人番号の名寄せ検索
 */

const BASE_URL = "https://info.gbiz.go.jp/hojin/v1/hojin";

export type GBizInfoCompany = {
  corporateNumber: string;
  name: string | null;
  nameKana: string | null;
  location: string | null; // 本社住所
  representative: string | null; // "代表取締役社長 山田太郎" 形式（gBizINFO は元々この結合形）
  capitalStockYen: number | null;
  foundedAt: string | null; // YYYY-MM-DD
  websiteUrl: string | null;
  businessSummary: string | null;
  postalCode: string | null;
};

type RawHojin = {
  corporate_number?: string;
  name?: string;
  kana?: string;
  location?: string;
  representative_name?: string;
  capital_stock?: number | string;
  date_of_establishment?: string;
  company_url?: string;
  business_summary?: string;
  postal_code?: string;
};

function token(): string {
  const t = process.env.GBIZINFO_API_TOKEN;
  if (!t) throw new Error("GBIZINFO_API_TOKEN env not set");
  return t;
}

function toCompany(r: RawHojin | undefined | null): GBizInfoCompany | null {
  if (!r || !r.corporate_number) return null;
  const cap =
    typeof r.capital_stock === "number"
      ? r.capital_stock
      : typeof r.capital_stock === "string" && r.capital_stock !== ""
        ? Number(r.capital_stock)
        : null;
  return {
    corporateNumber: r.corporate_number,
    name: r.name ?? null,
    nameKana: r.kana ?? null,
    location: r.location ?? null,
    // gBizINFO の representative_name は既に「役職 + 全角空白 + 氏名」の結合形
    representative: r.representative_name ?? null,
    capitalStockYen: cap !== null && Number.isFinite(cap) ? cap : null,
    foundedAt: r.date_of_establishment ?? null,
    websiteUrl: r.company_url ?? null,
    businessSummary: r.business_summary ?? null,
    postalCode: r.postal_code ?? null,
  };
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-hojinInfo-api-token": token(),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gBizINFO ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// gBizINFO の JSON はトップ直下にハイフン付きのキー "hojin-infos" を返す。
type Resp = { "hojin-infos"?: RawHojin[] };

export async function fetchByCorporateNumber(
  corporateNumber: string
): Promise<GBizInfoCompany | null> {
  try {
    const data = await request<Resp>(`/${corporateNumber}`);
    return toCompany(data["hojin-infos"]?.[0]);
  } catch (e) {
    if ((e as Error).message.includes("404")) return null;
    throw e;
  }
}

/**
 * 名称検索。1 ページ最大 5000 件、ここでは limit を絞って best-match を返す。
 * 完全一致優先、無ければ先頭をそのまま返す（呼び出し側で住所等で再検証する想定）。
 */
export async function searchByName(
  name: string,
  limit: number = 10
): Promise<GBizInfoCompany[]> {
  const q = encodeURIComponent(name);
  const data = await request<Resp>(`?name=${q}&limit=${limit}`);
  return (data["hojin-infos"] ?? [])
    .map(toCompany)
    .filter((c): c is GBizInfoCompany => c !== null);
}
