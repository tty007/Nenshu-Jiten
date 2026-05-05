import Link from "next/link";
import { UserTable } from "@/components/admin/UserTable";
import { listAdminUsers } from "@/lib/admin/get-admin-users";

export const metadata = { title: "ユーザー" };

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const result = await listAdminUsers({ page, search: search || undefined });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">ユーザー</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {result.total.toLocaleString("ja-JP")} 人
          {result.totalPages > 1 && (
            <span className="ml-2 text-ink-subtle">
              （{page} / {result.totalPages} ページ）
            </span>
          )}
        </p>
      </div>

      <form action="/admin/users" method="get" className="flex max-w-md items-stretch gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="email / nickname で検索"
          className="block h-9 min-w-0 flex-1 rounded-md border border-surface-border bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          検索
        </button>
      </form>

      <UserTable items={result.items} />

      {result.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={result.totalPages}
          search={search}
          pageSize={PAGE_SIZE}
        />
      )}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  search,
}: {
  page: number;
  totalPages: number;
  search: string;
  pageSize: number;
}) {
  const link = (p: number) => {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };
  const window = 2;
  const start = Math.max(1, page - window);
  const end = Math.min(totalPages, page + window);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <nav className="flex items-center justify-center gap-1 text-sm">
      <PageLink href={page > 1 ? link(page - 1) : null} label="←" />
      {start > 1 && (
        <>
          <PageLink href={link(1)} label="1" />
          {start > 2 && <span className="px-2 text-ink-subtle">…</span>}
        </>
      )}
      {pages.map((p) => (
        <PageLink key={p} href={link(p)} label={String(p)} active={p === page} />
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="px-2 text-ink-subtle">…</span>
          )}
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
  if (!href) {
    return (
      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-ink-subtle">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-brand-600 px-3 font-semibold text-white"
          : "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-ink hover:bg-surface-muted"
      }
    >
      {label}
    </Link>
  );
}
