import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import { redirect } from "next/navigation";
import { listCategoriesForAdmin } from "@/lib/admin/articles/get-categories";
import { CategoryManager } from "@/components/admin/articles/CategoryManager";

export const dynamic = "force-dynamic";

export default async function CategoriesAdminPage() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) redirect("/admin");

  const categories = await listCategoriesForAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/admin/articles"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          記事一覧へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">カテゴリ管理</h1>
        <p className="mt-1 text-sm text-ink-muted">
          記事の分類カテゴリ。子カテゴリを設定できます。記事公開時の URL は
          <code className="mx-1 font-mono">/articles/{`{カテゴリパス}`}/...</code>
          の形で組み立てられます。
        </p>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
