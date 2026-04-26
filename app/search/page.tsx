import { CompanyCard } from "@/components/CompanyCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SearchBox } from "@/components/SearchBox";
import {
  getAllCompanies,
  getAllIndustries,
  searchCompanies,
} from "@/lib/data/companies";
import type { CompanyWithLatestMetrics } from "@/types";

type SortKey = "salary" | "tenure" | "employees" | "revenue";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "salary", label: "平均年収順" },
  { key: "tenure", label: "勤続年数順" },
  { key: "employees", label: "従業員数順" },
  { key: "revenue", label: "売上高順" },
];

function getSortValue(
  c: CompanyWithLatestMetrics,
  key: SortKey
): number {
  switch (key) {
    case "salary":
      return c.latest.averageAnnualSalary ?? -Infinity;
    case "tenure":
      return c.latest.averageTenureYears ?? -Infinity;
    case "employees":
      return c.latest.employeeCount ?? -Infinity;
    case "revenue":
      return c.latest.revenue ?? -Infinity;
  }
}

function sortCompanies(
  list: CompanyWithLatestMetrics[],
  key: SortKey
): CompanyWithLatestMetrics[] {
  return [...list].sort((a, b) => getSortValue(b, key) - getSortValue(a, key));
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    industry?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const industryFilter = params.industry?.trim() ?? "";
  const sortKey = (params.sort as SortKey | undefined) ?? "salary";

  const industries = await getAllIndustries();
  let results = query ? await searchCompanies(query) : await getAllCompanies();
  if (industryFilter) {
    results = results.filter((c) => c.industryCode === industryFilter);
  }
  results = sortCompanies(results, sortKey);

  const headline = query
    ? `「${query}」の検索結果`
    : industryFilter
    ? `${industries.find((i) => i.code === industryFilter)?.name ?? "業界"}の企業`
    : "すべての企業";

  return (
    <>
      <Header showSearch={false} />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {headline}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {results.length} 社が見つかりました
            </p>
          </div>
          <SearchBox defaultValue={query} size="sm" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6">
            <FilterGroup title="業界">
              <ul className="space-y-1.5 text-sm">
                <li>
                  <FilterLink
                    label="すべて"
                    active={!industryFilter}
                    href={buildHref({ q: query, sort: sortKey })}
                  />
                </li>
                {industries.map((ind) => (
                  <li key={ind.code}>
                    <FilterLink
                      label={ind.name}
                      active={industryFilter === ind.code}
                      href={buildHref({
                        q: query,
                        industry: ind.code,
                        sort: sortKey,
                      })}
                    />
                  </li>
                ))}
              </ul>
            </FilterGroup>

            <FilterGroup title="並び順">
              <ul className="space-y-1.5 text-sm">
                {sortOptions.map((opt) => (
                  <li key={opt.key}>
                    <FilterLink
                      label={opt.label}
                      active={sortKey === opt.key}
                      href={buildHref({
                        q: query,
                        industry: industryFilter,
                        sort: opt.key,
                      })}
                    />
                  </li>
                ))}
              </ul>
            </FilterGroup>
          </aside>

          <div>
            {results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-white p-10 text-center">
                <p className="text-sm font-medium text-ink">
                  該当する企業が見つかりませんでした
                </p>
                <p className="mt-1 text-base text-ink-muted">
                  検索条件を変更してお試しください
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((c) => (
                  <CompanyCard key={c.id} company={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-4">
      <p className="text-base font-semibold tracking-wider text-ink-muted">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function FilterLink({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      className={`block rounded-md px-2 py-1 transition ${
        active
          ? "bg-brand-50 font-medium text-brand-600"
          : "text-ink-muted hover:bg-surface-muted hover:text-ink"
      }`}
    >
      {label}
    </a>
  );
}

function buildHref(params: {
  q?: string;
  industry?: string;
  sort?: string;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.industry) search.set("industry", params.industry);
  if (params.sort) search.set("sort", params.sort);
  const qs = search.toString();
  return qs ? `/search?${qs}` : "/search";
}
