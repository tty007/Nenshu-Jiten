// 東証 33 業種 → 賃金センサスの産業大分類 への変換
import type { CensusIndustry } from "./wage-census";

/**
 * 東証 33 業種の名称（DB の `industries.name` で使われている表記）から
 * 賃金センサスの産業区分にマッピングする。
 *
 * 該当するセンサス区分が無い業種（水産・農林業など）は null を返す。
 * その場合、呼び出し側は「全産業 年齢計」をフォールバックとして使う。
 */
const MAP: Record<string, CensusIndustry | null> = {
  // 鉱業
  "鉱業": "mining",

  // 建設業
  "建設業": "construction",

  // 製造業（東証 33 業種では 16 種ほどに細分化されているが、賃金センサスでは「製造業」で集約）
  "食料品": "manufacturing",
  "繊維製品": "manufacturing",
  "パルプ・紙": "manufacturing",
  "化学": "manufacturing",
  "医薬品": "manufacturing",
  "石油・石炭製品": "manufacturing",
  "ゴム製品": "manufacturing",
  "ガラス・土石製品": "manufacturing",
  "鉄鋼": "manufacturing",
  "非鉄金属": "manufacturing",
  "金属製品": "manufacturing",
  "機械": "manufacturing",
  "電気機器": "manufacturing",
  "輸送用機器": "manufacturing",
  "精密機器": "manufacturing",
  "その他製品": "manufacturing",

  // 電気・ガス
  "電気・ガス業": "utilities",

  // 運輸
  "陸運業": "transport_postal",
  "海運業": "transport_postal",
  "空運業": "transport_postal",
  "倉庫・運輸関連": "transport_postal",
  "倉庫・運輸関連業": "transport_postal",

  // 情報通信
  "情報・通信業": "ict",

  // 卸売・小売
  "卸売業": "wholesale_retail",
  "小売業": "wholesale_retail",

  // 金融・保険
  "銀行業": "finance_insurance",
  "証券、商品先物取引業": "finance_insurance",
  "証券業": "finance_insurance",
  "保険業": "finance_insurance",
  "その他金融業": "finance_insurance",

  // 不動産
  "不動産業": "real_estate_rental",

  // サービス
  "サービス業": "other_services",

  // 範囲外（センサスのカテゴリと一致しないもの）
  "水産・農林業": null,
};

export function mapIndustryNameToCensus(
  name: string | null | undefined
): CensusIndustry | null {
  if (!name) return null;
  if (name in MAP) return MAP[name];
  // ゆるい部分一致（賃金センサス側のカテゴリ名がそのまま入っている場合）
  if (name.includes("製造")) return "manufacturing";
  if (name.includes("情報") && name.includes("通信")) return "ict";
  if (name.includes("運輸")) return "transport_postal";
  if (name.includes("金融") || name.includes("保険") || name.includes("銀行"))
    return "finance_insurance";
  if (name.includes("卸売") || name.includes("小売"))
    return "wholesale_retail";
  if (name.includes("建設")) return "construction";
  if (name.includes("不動産")) return "real_estate_rental";
  if (name.includes("電気") && name.includes("ガス")) return "utilities";
  if (name.includes("サービス")) return "other_services";
  return null;
}
