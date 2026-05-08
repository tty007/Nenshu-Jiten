import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CompanyArticle } from "@/lib/data/company-articles";

const JST_DATE = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return JST_DATE.format(d);
}

type Props = {
  articles: CompanyArticle[];
  companyName: string;
};

export function CompanyArticleList({ articles, companyName }: Props) {
  if (articles.length === 0) {
    return (
      <div className="mt-8 flex min-h-[160px] items-center justify-center">
        <p className="text-sm text-ink-muted">まだコンテンツはありません</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-surface-border pb-3">
        <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
          {companyName} の関連記事
        </h2>
        <span className="font-mono text-xs font-semibold text-ink-muted">
          {String(articles.length).padStart(2, "0")} 件
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => (
          <li key={a.id}>
            <Link
              href={`/articles/${a.slug ?? a.id}`}
              className="company-article-card group relative flex h-full flex-col overflow-hidden rounded-md border border-surface-border p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_14px_30px_-12px_rgba(15,23,42,0.22)] sm:p-6"
              style={{
                animationDelay: `${(i % 6) * -2}s`,
              }}
            >
              <div className="flex items-center gap-2">
                {a.category ? (
                  <span
                    className="inline-flex items-center rounded-sm border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-brand-700"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    {a.category.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-sm border border-surface-border bg-surface-muted px-2 py-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
                    記事
                  </span>
                )}
              </div>

              <h3 className="mt-3 text-base font-bold leading-snug text-ink transition-colors group-hover:text-brand-700 sm:text-[1.05rem]">
                {a.title}
              </h3>

              {a.excerpt && (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                  {a.excerpt}
                </p>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
                <span className="font-mono text-[11px] text-ink-subtle">
                  更新 {fmt(a.updated_at)}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                  記事を読む
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* カード背景：常時うっすら流れる青系グラデ。減速 + 多色で柔らか */}
      <style>{`
        .company-article-card {
          background-image:
            linear-gradient(120deg,
              #ffffff 0%,
              #f0f9ff 22%,
              #eff6ff 45%,
              #ffffff 60%,
              #eef2ff 80%,
              #ffffff 100%);
          background-size: 240% 240%;
          background-position: 0% 50%;
          animation: companyArticleCardFlow 22s ease-in-out infinite;
        }
        .company-article-card:hover {
          animation-duration: 9s;
        }
        @keyframes companyArticleCardFlow {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .company-article-card { animation: none; }
        }
      `}</style>
    </div>
  );
}
