/**
 * 企業詳細ページ用の JSON-LD 構造化データビルダー。
 *
 * - Organization: 企業エンティティ。EDINET の有報 URL を `sameAs`、業種を
 *   `naics` 相当の自由項目として保持。Wikidata ID は将来 Phase 2 で `sameAs` 追加。
 * - Dataset:      その企業の「平均年収・従業員数・業績の時系列」自体を
 *   データセットとして宣言（Google Dataset Search 用）。distribution には
 *   EDINET の有報 URL を載せる。
 * - BreadcrumbList: ホーム → 業界一覧 → 当該業界 → 企業
 *
 * 出力は jsonLdToScript で XSS エスケープした上で `<script type="application/ld+json">`
 * に流し込む。jsonLdToScript は記事側と同じものを共用したいので、本ファイルでは
 * import する。
 */
import { jsonLdToScript } from "@/lib/article-jsonld";

export { jsonLdToScript };

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://nenshu-jiten.com";
const SITE_NAME = "年収辞典";

export type CompanyForJsonLd = {
  edinetCode: string;
  name: string;
  nameKana: string | null;
  websiteUrl: string | null;
  industryCode: string | null;
  industryName: string | null;
  listedMarket: string | null;
  foundedYear: number | null;
  headquarters: string | null;
  description: string | null;
  summary: string | null;
  latestDocId: string | null;
  latestFiscalYear: number | null;
};

/** EDINET の有報照会 URL（docId が分かっていれば直リンク、不明なら EDINET 検索 TOP） */
function edinetDocUrl(docId: string | null): string {
  if (docId) {
    return `https://disclosure2.edinet-fsa.go.jp/WEKW0040.aspx?DocumentId=${encodeURIComponent(
      docId,
    )}`;
  }
  return "https://disclosure2.edinet-fsa.go.jp/";
}

export function buildOrganizationJsonLd(c: CompanyForJsonLd): unknown {
  const url = `${SITE_URL}/companies/${c.edinetCode}`;
  const sameAs: string[] = [];
  if (c.websiteUrl) sameAs.push(c.websiteUrl);
  sameAs.push(edinetDocUrl(c.latestDocId));

  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}#organization`,
    name: c.name,
    url,
    mainEntityOfPage: url,
    sameAs,
    ...(c.nameKana ? { alternateName: c.nameKana } : {}),
    ...(c.industryName ? { industry: c.industryName } : {}),
    ...(c.foundedYear ? { foundingDate: String(c.foundedYear) } : {}),
    ...(c.headquarters ? { address: c.headquarters } : {}),
    ...(c.description || c.summary
      ? { description: (c.summary ?? c.description ?? "").slice(0, 500) }
      : {}),
    ...(c.listedMarket
      ? {
          memberOf: {
            "@type": "Organization",
            name: `東京証券取引所 ${c.listedMarket}市場`,
          },
        }
      : {}),
  };
  return out;
}

export function buildCompanyDatasetJsonLd(c: CompanyForJsonLd): unknown {
  const url = `${SITE_URL}/companies/${c.edinetCode}`;
  const distributionUrl = edinetDocUrl(c.latestDocId);
  const yearLabel = c.latestFiscalYear
    ? `${c.latestFiscalYear} 年度時点`
    : "最新有価証券報告書時点";
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    name: `${c.name} の平均年収・従業員数・業績データ（${yearLabel}）`,
    description: `${c.name}（EDINET コード ${c.edinetCode}）の有価証券報告書に基づく平均年収・平均勤続年数・従業員数・売上・営業利益などの時系列データ。`,
    url,
    keywords: [
      c.name,
      "平均年収",
      "従業員数",
      "勤続年数",
      "業績",
      "有価証券報告書",
      "EDINET",
      ...(c.industryName ? [c.industryName] : []),
    ],
    inLanguage: "ja",
    license: "https://www.fsa.go.jp/policy/edinet/",
    creator: {
      "@type": "GovernmentOrganization",
      name: "金融庁",
      url: "https://www.fsa.go.jp/",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    isBasedOn: distributionUrl,
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/html",
        contentUrl: distributionUrl,
      },
    ],
    about: { "@id": `${url}#organization` },
  };
}

export function buildCompanyBreadcrumbJsonLd(c: CompanyForJsonLd): unknown {
  const url = `${SITE_URL}/companies/${c.edinetCode}`;
  const items: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
    {
      "@type": "ListItem",
      position: 2,
      name: "業界一覧",
      item: `${SITE_URL}/industries`,
    },
  ];
  if (c.industryName && c.industryCode) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: c.industryName,
      item: `${SITE_URL}/search?industry=${encodeURIComponent(c.industryCode)}`,
    });
    items.push({
      "@type": "ListItem",
      position: 4,
      name: c.name,
      item: url,
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: c.name,
      item: url,
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}
