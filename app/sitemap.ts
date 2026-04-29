import type { MetadataRoute } from "next";
import {
  getAllIndustries,
  getCompanyIndexForSitemap,
} from "@/lib/data/companies";

// 1日に1回再生成。ETL（毎日 03:00 JST）後の次のクロールで最新化される。
export const revalidate = 86400;

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBase();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/search`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/industries`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/data-source`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms-of-service`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const [companies, industries] = await Promise.all([
    getCompanyIndexForSitemap(),
    getAllIndustries(),
  ]);

  const companyPages: MetadataRoute.Sitemap = companies.map((c) => ({
    url: `${base}/companies/${c.edinetCode}`,
    lastModified: c.lastModified ?? now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const industryPages: MetadataRoute.Sitemap = industries.map((i) => ({
    url: `${base}/search?industry=${i.code}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...companyPages, ...industryPages];
}
