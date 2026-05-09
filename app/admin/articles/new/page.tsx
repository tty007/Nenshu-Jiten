import { redirect, notFound } from "next/navigation";
import { createArticleRecord } from "@/lib/admin/articles/get-articles";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";

export const metadata = { title: "新規記事作成" };
export const dynamic = "force-dynamic";

/**
 * /admin/articles/new?companyId=XXX[,YYY,ZZZ]
 *
 * 空 draft を作成して即 /admin/articles/[id] にリダイレクト。
 * companyId クエリで初期紐付け企業を渡せる（モーダルから遷移する想定）。
 *
 * 著者は createArticleRecord 側で「年収辞典編集部 (slug='editorial')」を
 * デフォルトとして自動セット（authorId を渡さない）。
 *
 * 注意: render 中は revalidatePath を呼べない（Next.js のルール）。
 * 直後に redirect するので revalidate 不要のため、Server Action ではなく
 * 直接 createArticleRecord を呼ぶ。
 */
export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string | string[] }>;
}) {
  const allowed = await isCurrentUserAdmin();
  if (!allowed) notFound();

  const sp = await searchParams;
  const raw = sp.companyId;
  const initialCompanyIds: string[] = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const result = await createArticleRecord({
    initialCompanyIds,
  });
  if ("error" in result) {
    throw new Error(result.error);
  }
  redirect(`/admin/articles/${result.id}`);
}
