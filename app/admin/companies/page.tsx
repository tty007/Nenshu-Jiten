import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CompanyListFilters } from "@/components/admin/companies/CompanyListFilters";
import { CompanyListTable } from "@/components/admin/companies/CompanyListTable";
import {
  listAdminCompanies,
  listAdminIndustries,
} from "@/lib/admin/get-admin-companies";

export const metadata = { title: "企業リスト" };

const PAGE_SIZE = 50;

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    industry?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ rows, total }, industries] = await Promise.all([
    listAdminCompanies({
      search: sp.q,
      industryCode: sp.industry,
      limit: PAGE_SIZE,
      offset,
    }),
    listAdminIndustries(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.industry) params.set("industry", sp.industry);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/companies?${qs}` : "/admin/companies";
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">企業リスト</h1>
          <p className="mt-1 text-sm text-ink-muted">
            上場企業を検索・絞り込みできます
          </p>
        </div>
        <div className="text-sm text-ink-muted">
          全{" "}
          <span className="font-numeric font-semibold tabular-nums text-ink">
            {total.toLocaleString("ja-JP")}
          </span>{" "}
          社
        </div>
      </header>

      <CompanyListFilters
        industries={industries}
        initialSearch={sp.q ?? ""}
        initialIndustry={sp.industry ?? ""}
      />

      <CompanyListTable rows={rows} />

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <div className="text-ink-muted">
            <span className="font-numeric tabular-nums">
              {(offset + 1).toLocaleString("ja-JP")}
            </span>
            {" - "}
            <span className="font-numeric tabular-nums">
              {Math.min(offset + rows.length, total).toLocaleString("ja-JP")}
            </span>
            {" / "}
            <span className="font-numeric tabular-nums">
              {total.toLocaleString("ja-JP")}
            </span>{" "}
            社
          </div>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-sm text-ink hover:bg-surface-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                前へ
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-muted/50 px-3 py-1.5 text-sm text-ink-subtle">
                <ChevronLeft className="h-4 w-4" />
                前へ
              </span>
            )}
            <span className="px-3 text-xs text-ink-muted">
              <span className="font-numeric font-semibold tabular-nums text-ink">
                {page}
              </span>{" "}
              / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-sm text-ink hover:bg-surface-muted"
              >
                次へ
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-muted/50 px-3 py-1.5 text-sm text-ink-subtle">
                次へ
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
