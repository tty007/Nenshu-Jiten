"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import {
  searchCompaniesForEditor as _searchCompaniesForEditor,
  listArticles as _listArticles,
  createArticleRecord,
} from "./get-articles";

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  | { ok: true; actorId: string | null }
  | { ok: false; error: string }
> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  const user = await getCurrentUser();
  return { ok: true, actorId: user?.id ?? null };
}

// =====================================================================
// 記事作成（空の draft を作って ID を返す → /admin/articles/[id] へ遷移）
// =====================================================================

export async function createArticle(opts: {
  initialCompanyIds?: string[];
} = {}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  // 著者はデフォルトで「年収辞典編集部」(slug='editorial') が入る。
  // authorId を渡さないことで createArticleRecord 側がフォールバック解決する。
  const result = await createArticleRecord({
    initialCompanyIds: opts.initialCompanyIds,
  });
  if ("error" in result) return { ok: false, error: result.error };

  revalidatePath("/admin/articles");
  return { ok: true, data: { id: result.id } };
}

// =====================================================================
// 記事の保存（タイトル + 本文）
// =====================================================================

// =====================================================================
// スラッグ設定
// =====================================================================

// 記事の slug は `/` 区切りの複数セグメント可（カテゴリパス + 企業コード等）。
// 各セグメントは半角英数（大小区別なし）とハイフン。EDINET コードの大文字を保持。
// 例: salary/E12345-E67890 / news/industry/E12345
const SLUG_PATTERN =
  /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)*$/;

/** 入力文字列を「半角英数 + ハイフン + スラッシュ区切り」に正規化（大小はそのまま保持） */
function normalizeSlug(input: string): string {
  return input
    .normalize("NFKD") // 全角→半角・カナ分解
    // / は区切りとして残す。a-zA-Z0-9-/ 以外を - に
    .replace(/[^A-Za-z0-9/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    // セグメント境界に紛れた - を除去
    .replace(/-+\/+/g, "/")
    .replace(/\/+-+/g, "/")
    // 先頭・末尾の - / を除去
    .replace(/^[/-]+|[/-]+$/g, "")
    .slice(0, 200);
}

export async function setArticleSlug(
  articleId: string,
  rawSlug: string | null
): Promise<ActionResult<{ slug: string | null }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  if (rawSlug == null || rawSlug.trim() === "") {
    // 解除
    const upd = await sb
      .from("articles")
      .update({ slug: null })
      .eq("id", articleId);
    if (upd.error) return { ok: false, error: upd.error.message };
    revalidatePath(`/admin/articles/${articleId}`);
    revalidatePath(`/articles/${articleId}`);
    return { ok: true, data: { slug: null } };
  }

  const slug = normalizeSlug(rawSlug);
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: "スラッグは半角英数とハイフンのみ・1〜100 文字で指定してください",
    };
  }

  // 重複チェック（自分以外）
  const dup = await sb
    .from("articles")
    .select("id")
    .eq("slug", slug)
    .neq("id", articleId)
    .maybeSingle();
  if (dup.data) {
    return { ok: false, error: `このスラッグは別の記事で使用中です: ${slug}` };
  }

  const upd = await sb
    .from("articles")
    .update({ slug })
    .eq("id", articleId);
  if (upd.error) return { ok: false, error: upd.error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath(`/articles/${slug}`);
  revalidatePath(`/articles/${articleId}`);
  return { ok: true, data: { slug } };
}

export async function saveArticle(
  id: string,
  patch: {
    title?: string;
    body_html?: string;
    body_json?: unknown;
    status?: "draft" | "published" | "archived";
  }
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.body_html !== undefined) updates.body_html = patch.body_html;
  if (patch.body_json !== undefined) updates.body_json = patch.body_json;
  if (patch.status !== undefined) updates.status = patch.status;

  if (Object.keys(updates).length === 0) return { ok: true };

  const upd = await sb.from("articles").update(updates).eq("id", id);
  if (upd.error) return { ok: false, error: upd.error.message };

  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath(`/admin/articles/${id}/preview`);
  // 公開ルートのキャッシュも無効化（公開→閲覧 / 下書き戻し → 404 を即時反映）
  revalidatePath(`/articles/${id}`);
  return { ok: true };
}

// =====================================================================
// 紐付き企業の追加・削除・並び替え
// =====================================================================

export async function addCompanyToArticle(
  articleId: string,
  companyId: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  // 現在の最大 display_order を取得
  const maxRes = await sb
    .from("article_companies")
    .select("display_order")
    .eq("article_id", articleId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRes.data?.display_order as number | undefined) ?? -1) + 1;

  const ins = await sb.from("article_companies").upsert({
    article_id: articleId,
    company_id: companyId,
    display_order: nextOrder,
  });
  if (ins.error) return { ok: false, error: ins.error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

export async function removeCompanyFromArticle(
  articleId: string,
  companyId: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  const del = await sb
    .from("article_companies")
    .delete()
    .eq("article_id", articleId)
    .eq("company_id", companyId);
  if (del.error) return { ok: false, error: del.error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

// =====================================================================
// 削除
// =====================================================================

export async function deleteArticle(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  const del = await sb.from("articles").delete().eq("id", id);
  if (del.error) return { ok: false, error: del.error.message };

  revalidatePath("/admin/articles");
  return { ok: true };
}

/**
 * 複数記事を一括削除。1 リクエストで最大 200 件まで。
 */
export async function deleteArticles(
  ids: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (ids.length === 0) return { ok: false, error: "削除対象が空です" };
  if (ids.length > 200) {
    return { ok: false, error: "1 回の削除は最大 200 件までです" };
  }

  const sb = createSupabaseAdminClient();
  const del = await sb.from("articles").delete().in("id", ids).select("id");
  if (del.error) return { ok: false, error: del.error.message };

  revalidatePath("/admin/articles");
  return { ok: true, data: { deletedCount: del.data?.length ?? 0 } };
}

// =====================================================================
// 企業セレクタの検索（Server Action として export して fetch 不要にする）
// =====================================================================

export async function searchCompaniesForEditor(
  query: string
): Promise<
  | {
      ok: true;
      data: Array<{
        id: string;
        edinet_code: string;
        name: string;
        name_kana: string | null;
        industry_name: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  try {
    const data = await _searchCompaniesForEditor(query);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 企業モーダル「記事一覧」タブ用：その企業に紐づく記事を取得
 */
export async function fetchArticlesForCompany(
  companyId: string
): Promise<
  | {
      ok: true;
      data: Array<{
        id: string;
        title: string;
        status: string;
        updated_at: string;
        company_count: number;
      }>;
    }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  try {
    const { rows } = await _listArticles({ companyId, limit: 100 });
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        updated_at: r.updated_at,
        company_count: r.company_count,
      })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
