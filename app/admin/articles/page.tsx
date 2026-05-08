import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { ArticleListTable } from "@/components/admin/articles/ArticleListTable";
import { listArticles } from "@/lib/admin/articles/get-articles";

export const metadata = { title: "記事一覧" };
export const dynamic = "force-dynamic";

export default async function ArticlesIndexPage() {
  const { rows, total } = await listArticles({ limit: 200 });

  // 0 件のときだけページ側で空状態を表示。
  // それ以外は ArticleListTable がヘッダーごと描画する（選択時に右側のボタンを差し替えるため）
  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-ink">記事一覧</h1>
          <p className="mt-1 text-sm text-ink-muted">全 0 件</p>
        </header>

        <div className="flex flex-col items-center justify-center gap-3 border-y border-surface-border py-16 text-center">
          <FileText className="h-8 w-8 text-ink-subtle" aria-hidden />
          <p className="text-sm font-medium text-ink">記事はまだありません</p>
          <Link
            href="/admin/articles/new"
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            最初の記事を作成
          </Link>
        </div>
      </div>
    );
  }

  return <ArticleListTable rows={rows} total={total} />;
}
