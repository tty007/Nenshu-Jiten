import Link from "next/link";
import { Heart } from "lucide-react";
import { CompanyCard } from "@/components/CompanyCard";
import {
  getMyFavorites,
  type FavoriteSort,
} from "@/lib/favorites/get-favorites";

export const metadata = {
  title: "お気に入り",
};

const SORT_OPTIONS: { key: FavoriteSort; label: string }[] = [
  { key: "added", label: "追加日が新しい順" },
  { key: "salary", label: "平均年収順" },
  { key: "tenure", label: "勤続年数順" },
  { key: "employees", label: "従業員数順" },
  { key: "revenue", label: "売上高順" },
];

const VALID_SORTS = new Set<FavoriteSort>(SORT_OPTIONS.map((o) => o.key));

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const industryCode = params.industry?.trim() || null;
  const sort: FavoriteSort = VALID_SORTS.has(params.sort as FavoriteSort)
    ? (params.sort as FavoriteSort)
    : "added";

  // 全件 + 並び順だけ反映して取得し、業界タブと表示用 items を一度のクエリで作る
  const all = await getMyFavorites({ sort });
  const totalAll = all.length;

  // 業界別カウント + 名前
  const indMap = new Map<string, { name: string; n: number }>();
  for (const it of all) {
    const code = it.company.industryCode;
    if (!code) continue;
    const name = it.company.industryName ?? code;
    const cur = indMap.get(code);
    if (cur) cur.n++;
    else indMap.set(code, { name, n: 1 });
  }
  const industries = Array.from(indMap.entries())
    .map(([code, v]) => ({ code, name: v.name, n: v.n }))
    .sort((a, b) => b.n - a.n);

  const items = industryCode
    ? all.filter((it) => it.company.industryCode === industryCode)
    : all;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">お気に入り</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {totalAll === 0
            ? "気になる企業を登録するとここに表示されます。"
            : `${totalAll} 社を登録中`}
        </p>
      </div>

      {totalAll === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* 業界タブ */}
          <nav
            aria-label="業界フィルタ"
            className="-mx-4 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] sm:mx-0 sm:px-0"
          >
            <ul className="flex min-w-max gap-2">
              <li>
                <TabLink
                  href={buildHref({ sort })}
                  active={!industryCode}
                  label={`すべて`}
                  count={totalAll}
                />
              </li>
              {industries.map((ind) => (
                <li key={ind.code}>
                  <TabLink
                    href={buildHref({ industry: ind.code, sort })}
                    active={industryCode === ind.code}
                    label={ind.name}
                    count={ind.n}
                  />
                </li>
              ))}
            </ul>
          </nav>

          {/* 並び順 */}
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-ink-muted">並び順</span>
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.key;
                return (
                  <Link
                    key={opt.key}
                    href={buildHref({
                      industry: industryCode ?? undefined,
                      sort: opt.key,
                    })}
                    className={
                      active
                        ? "rounded-full bg-brand-600 px-3 py-1 font-semibold text-white"
                        : "rounded-full px-3 py-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
                    }
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* グリッド */}
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-surface-border bg-white p-10 text-center text-sm text-ink-muted">
              この業界のお気に入りはまだありません。
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((it) => (
                <CompanyCard key={it.company.id} company={it.company} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white"
          : "inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-brand-50 hover:text-brand-700"
      }
    >
      {label}
      <span
        className={
          active
            ? "rounded-full bg-white/25 px-1.5 text-xs font-bold tabular-nums"
            : "rounded-full bg-surface-muted px-1.5 text-xs font-bold tabular-nums"
        }
      >
        {count}
      </span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-surface-border bg-white p-10 text-center sm:p-16">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600">
        <Heart className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold text-ink">
        お気に入りはまだありません
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        企業ページの右上にあるハートマークから登録できます。
      </p>
      <Link
        href="/search"
        className="mt-5 inline-flex items-center justify-center rounded-md bg-gradient-to-r from-blue-700 to-sky-400 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-blue-800 hover:to-sky-500"
      >
        企業を探す
      </Link>
    </div>
  );
}

function buildHref(params: { industry?: string; sort?: FavoriteSort }): string {
  const sp = new URLSearchParams();
  if (params.industry) sp.set("industry", params.industry);
  if (params.sort && params.sort !== "added") sp.set("sort", params.sort);
  const qs = sp.toString();
  return qs ? `/mypage/favorites?${qs}` : "/mypage/favorites";
}
