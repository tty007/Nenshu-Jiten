import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import { redirect } from "next/navigation";
import { listAuthorsForAdmin } from "@/lib/admin/articles/get-authors";
import { AuthorManager } from "@/components/admin/articles/AuthorManager";

export const dynamic = "force-dynamic";

export default async function AuthorsAdminPage() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) redirect("/admin");

  const authors = await listAuthorsForAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/articles"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            記事一覧へ戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink">著者管理</h1>
          <p className="mt-1 text-sm text-ink-muted">
            記事の著者・編集者プロフィール。記事ページのフッター（著者カード）と将来の <code>/authors/{`{slug}`}</code> 個別ページに使われます。
          </p>
        </div>
      </div>

      <AuthorManager initialAuthors={authors} />
    </div>
  );
}
