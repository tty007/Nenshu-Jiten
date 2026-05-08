"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

type IndustryOption = { code: string; name: string };

type Props = {
  industries: IndustryOption[];
  initialSearch: string;
  initialIndustry: string;
};

export function CompanyListFilters({
  industries,
  initialSearch,
  initialIndustry,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [industry, setIndustry] = useState(initialIndustry);
  const [isPending, startTransition] = useTransition();

  // URL クエリ変化を反映（ブラウザ戻る対応）
  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
    setIndustry(searchParams.get("industry") ?? "");
  }, [searchParams]);

  const apply = (overrides?: { q?: string; industry?: string }) => {
    const params = new URLSearchParams();
    const q = overrides?.q ?? search;
    const ind = overrides?.industry ?? industry;
    if (q) params.set("q", q);
    if (ind) params.set("industry", ind);
    // フィルタ変更したら 1 ページ目に戻る
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/admin/companies?${qs}` : "/admin/companies");
    });
  };

  const reset = () => {
    setSearch("");
    setIndustry("");
    startTransition(() => {
      router.push("/admin/companies");
    });
  };

  const hasFilter = Boolean(search || industry);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs font-medium text-ink-muted">
          検索（社名・カナ・EDINET・証券コード）
        </label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="例: トヨタ / E02144 / 7203"
            className="w-full rounded-md border border-surface-border bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-ink-muted">業界</label>
        <select
          value={industry}
          onChange={(e) => {
            setIndustry(e.target.value);
            apply({ industry: e.target.value });
          }}
          className="mt-1 w-full rounded-md border border-surface-border bg-white p-1.5 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">すべて</option>
          {industries.map((i) => (
            <option key={i.code} value={i.code}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
      >
        検索
      </button>

      {hasFilter && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
          クリア
        </button>
      )}
    </form>
  );
}
