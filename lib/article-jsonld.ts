/**
 * 記事公開ページ用の JSON-LD 構造化データビルダー。
 *
 * - Article（タイトル / 日付 / 著者 / 出版社）
 * - isAccessibleForFree / hasPart によるペイウォール明示
 *   （Schema.org + Google Flexible Sampling 準拠）
 * - BreadcrumbList（ホーム → 記事 → タイトル）
 *
 * これらは <script type="application/ld+json"> として埋め込み、
 * クロール時にだけ参照される（ユーザ UI への影響なし）。
 */

import type { PublishedArticle } from "@/lib/data/published-article";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://nenshu-jiten.com";
const SITE_NAME = "年収辞典";

export function buildArticleJsonLd(article: PublishedArticle): unknown {
  const url = `${SITE_URL}/articles/${article.slug ?? article.id}`;
  const description = (article.body_html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  // ペイウォール検出：本文中に data-member-only="true" があれば一部限定扱い
  const hasMemberOnly = (article.body_html ?? "").includes(
    'data-member-only="true"'
  );

  const author = article.author
    ? {
        "@type": "Person",
        name: article.author.name,
        url: `${SITE_URL}/authors/${article.author.slug}`,
        ...(article.author.bio ? { description: article.author.bio } : {}),
        ...(article.author.avatar_url
          ? { image: article.author.avatar_url }
          : {}),
      }
    : {
        "@type": "Organization",
        name: `${SITE_NAME}編集部`,
      };

  const article_jsonld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: article.title || "（無題）",
    description,
    url,
    datePublished: article.created_at,
    dateModified: article.updated_at,
    author,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    inLanguage: "ja",
    // ペイウォール明示
    isAccessibleForFree: !hasMemberOnly,
    ...(hasMemberOnly && {
      hasPart: [
        {
          "@type": "WebPageElement",
          isAccessibleForFree: false,
          cssSelector: ".member-only",
        },
      ],
    }),
  };

  return article_jsonld;
}

export function buildBreadcrumbJsonLd(article: PublishedArticle): unknown {
  const url = `${SITE_URL}/articles/${article.slug ?? article.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "記事",
        item: `${SITE_URL}/articles`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title || "（無題）",
        item: url,
      },
    ],
  };
}

/** JSON.stringify した文字列の `</script>` 攻撃を無効化（XSS 緩和） */
export function jsonLdToScript(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
