import Link from "next/link";
import { Lock } from "lucide-react";
import { CompanyCard } from "@/components/CompanyCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SearchBox } from "@/components/SearchBox";
import { SearchFilterButton } from "@/components/SearchFilterModal";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getMyUserProfile } from "@/lib/profile/get-user-profile";
import {
  getAllIndustries,
  searchCompaniesPaged,
  type SortKey,
} from "@/lib/data/companies";

const PAGE_SIZE = 30;
const SALARY_MAX = 3000; // 万円

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    industry?: string;
    sort?: string;
    page?: string;
    salaryMin?: string;
    salaryMax?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const industryCodes =
    params.industry
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const sortKey = (params.sort as SortKey | undefined) ?? "salary";
  const page = Math.max(1, Number(params.page) || 1);
  const salaryMin = clampInt(params.salaryMin, 0, SALARY_MAX, 0);
  const salaryMax = clampInt(params.salaryMax, 0, SALARY_MAX, SALARY_MAX);

  const [industries, result, user, attrs] = await Promise.all([
    getAllIndustries(),
    searchCompaniesPaged({
      query,
      industryCodes: industryCodes.length > 0 ? industryCodes : undefined,
      sort: sortKey,
      page,
      pageSize: PAGE_SIZE,
      salaryMinYen: salaryMin > 0 ? salaryMin * 10_000 : null,
      salaryMaxYen: salaryMax < SALARY_MAX ? salaryMax * 10_000 : null,
    }),
    getCurrentUser(),
    getMyUserProfile(),
  ]);
  const lockReason: "unauth" | "incomplete_profile" | null = !user
    ? "unauth"
    : !attrs ||
      !attrs.nickname ||
      !attrs.birthYear ||
      !attrs.gender ||
      !attrs.prefecture ||
      !attrs.careerStatus ||
      !attrs.salaryBand
    ? "incomplete_profile"
    : null;
  const locked = lockReason !== null;
  const baseQs = buildHref({
    q: query,
    industries: industryCodes,
    sort: sortKey,
    salaryMin,
    salaryMax,
  });
  const returnTo = baseQs;

  const headline = query
    ? `「${query}」の検索結果`
    : industryCodes.length === 1
    ? `${industries.find((i) => i.code === industryCodes[0])?.name ?? "業界"}の企業`
    : industryCodes.length > 1
    ? `選択した ${industryCodes.length} 業界の企業`
    : "すべての企業";

  return (
    <>
      <Header showSearch={false} />
      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {headline}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {result.total.toLocaleString("ja-JP")} 社が見つかりました
            {result.totalPages > 1 && (
              <span className="ml-2 text-ink-subtle">
                （{page} / {result.totalPages} ページ）
              </span>
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <SearchBox defaultValue={query} size="sm" />
          </div>
          <SearchFilterButton
            industries={industries}
            query={query}
            current={{
              industryCodes,
              sort: sortKey,
              salaryMin,
              salaryMax,
            }}
          />
        </div>

        <div className="mt-8">
          {result.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-border bg-white p-10 text-center">
              <p className="text-sm font-medium text-ink">
                該当する企業が見つかりませんでした
              </p>
              <p className="mt-1 text-base text-ink-muted">
                検索条件を変更してお試しください
              </p>
            </div>
          ) : (
            <div className="relative">
              <div
                className={
                  locked
                    ? "pointer-events-none select-none blur-md"
                    : undefined
                }
                aria-hidden={locked || undefined}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {result.items.map((c) => (
                    <CompanyCard key={c.id} company={c} />
                  ))}
                </div>
                {result.totalPages > 1 && (
                  <Pagination
                    page={page}
                    totalPages={result.totalPages}
                    baseHref={baseQs}
                  />
                )}
              </div>
              {locked && lockReason && (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-center p-4 pt-24">
                  <div className="pointer-events-auto sticky top-24">
                    <SearchUnlockCta reason={lockReason} returnTo={returnTo} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function clampInt(
  v: string | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function Pagination({
  page,
  totalPages,
  baseHref,
}: {
  page: number;
  totalPages: number;
  baseHref: string;
}) {
  const sep = baseHref.includes("?") ? "&" : "?";
  const link = (p: number) => `${baseHref}${sep}page=${p}`;
  const window = 2;
  const start = Math.max(1, page - window);
  const end = Math.min(totalPages, page + window);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1 text-sm">
      <PageLink href={page > 1 ? link(page - 1) : null} label="←" />
      {start > 1 && (
        <>
          <PageLink href={link(1)} label="1" />
          {start > 2 && <span className="px-2 text-ink-subtle">…</span>}
        </>
      )}
      {pages.map((p) => (
        <PageLink
          key={p}
          href={link(p)}
          label={String(p)}
          active={p === page}
        />
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-2 text-ink-subtle">…</span>}
          <PageLink href={link(totalPages)} label={String(totalPages)} />
        </>
      )}
      <PageLink href={page < totalPages ? link(page + 1) : null} label="→" />
    </nav>
  );
}

function PageLink({
  href,
  label,
  active,
}: {
  href: string | null;
  label: string;
  active?: boolean;
}) {
  if (!href)
    return (
      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-ink-subtle">
        {label}
      </span>
    );
  return (
    <a
      href={href}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 transition ${
        active
          ? "bg-brand-600 font-semibold text-white"
          : "text-ink hover:bg-surface-muted"
      }`}
    >
      {label}
    </a>
  );
}

function SearchUnlockCta({
  reason,
  returnTo,
}: {
  reason: "unauth" | "incomplete_profile";
  returnTo: string;
}) {
  return (
    <div className="max-w-md rounded-2xl border border-surface-border bg-white/95 p-6 text-center shadow-xl backdrop-blur-sm sm:p-8">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Lock className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">
        ランキングは会員限定です
      </h3>
      {reason === "unauth" ? (
        <>
          <p className="mt-2 text-sm text-ink-muted">
            会員登録（無料）とプロフィール入力で、すべての企業情報を見られます。
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href={`/auth/sign-in?next=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              ログイン
            </Link>
            <Link
              href={`/auth/sign-up?next=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              会員登録
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-muted">
            マイページのプロフィールをすべて入力すると見られます。
          </p>
          <div className="mt-5">
            <Link
              href="/mypage"
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              プロフィールを設定する
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function buildHref(params: {
  q?: string;
  industries?: string[];
  sort?: string;
  salaryMin?: number;
  salaryMax?: number;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.industries && params.industries.length > 0)
    search.set("industry", params.industries.join(","));
  if (params.sort && params.sort !== "salary") search.set("sort", params.sort);
  if (params.salaryMin && params.salaryMin > 0)
    search.set("salaryMin", String(params.salaryMin));
  if (params.salaryMax && params.salaryMax < SALARY_MAX)
    search.set("salaryMax", String(params.salaryMax));
  const qs = search.toString();
  return qs ? `/search?${qs}` : "/search";
}
