"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";

export type CategoryActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  return { ok: true };
}

export type CategoryInput = {
  parent_id?: string | null;
  slug: string;
  name: string;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createCategory(
  input: CategoryInput
): Promise<CategoryActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.name?.trim()) return { ok: false, error: "カテゴリ名は必須です" };
  const slug = normalizeSlug(input.slug);
  if (!slug || !SLUG_PATTERN.test(slug))
    return {
      ok: false,
      error: "slug は半角英数とハイフンのみで指定してください",
    };

  const sb = createSupabaseAdminClient();
  const ins = await sb
    .from("article_categories")
    .insert({
      parent_id: input.parent_id ?? null,
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      display_order: input.display_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .select("id")
    .single();
  if (ins.error) return { ok: false, error: ins.error.message };

  revalidatePath("/admin/articles/categories");
  return { ok: true, data: { id: ins.data.id as string } };
}

export async function updateCategory(
  id: string,
  patch: Partial<CategoryInput>
): Promise<CategoryActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  // 自身の子孫を parent に指定すると循環するのでブロック
  if (patch.parent_id) {
    if (patch.parent_id === id)
      return { ok: false, error: "親に自身を指定できません" };
    const cycle = await isDescendant(sb, patch.parent_id, id);
    if (cycle)
      return { ok: false, error: "親に自身の子孫を指定することはできません" };
  }

  const updates: Record<string, unknown> = {};
  if (patch.parent_id !== undefined) updates.parent_id = patch.parent_id;
  if (patch.slug !== undefined) {
    const slug = normalizeSlug(patch.slug);
    if (!slug || !SLUG_PATTERN.test(slug))
      return { ok: false, error: "slug の形式が不正です" };
    updates.slug = slug;
  }
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.description !== undefined)
    updates.description = patch.description?.trim() || null;
  if (patch.display_order !== undefined)
    updates.display_order = patch.display_order;
  if (patch.is_active !== undefined) updates.is_active = patch.is_active;
  if (Object.keys(updates).length === 0) return { ok: true };

  const upd = await sb
    .from("article_categories")
    .update(updates)
    .eq("id", id);
  if (upd.error) return { ok: false, error: upd.error.message };
  revalidatePath("/admin/articles/categories");
  revalidatePath("/admin/articles");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  // 子カテゴリがあれば削除不可
  const childCheck = await sb
    .from("article_categories")
    .select("id")
    .eq("parent_id", id)
    .limit(1);
  if (childCheck.data && childCheck.data.length > 0) {
    return {
      ok: false,
      error: "子カテゴリが存在するため削除できません。先に子を削除/移動してください",
    };
  }

  const del = await sb.from("article_categories").delete().eq("id", id);
  if (del.error) return { ok: false, error: del.error.message };
  revalidatePath("/admin/articles/categories");
  return { ok: true };
}

/** 記事に対するカテゴリ割り当て */
export async function setArticleCategory(
  articleId: string,
  categoryId: string | null
): Promise<CategoryActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();
  const upd = await sb
    .from("articles")
    .update({ category_id: categoryId })
    .eq("id", articleId);
  if (upd.error) return { ok: false, error: upd.error.message };
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

/** クライアントから呼ぶための active カテゴリ一覧（軽量） */
export async function listCategoriesForSelectorClient() {
  const { listCategoriesForSelector } = await import("./get-categories");
  return await listCategoriesForSelector();
}

/**
 * slug パス（例: "salary" や "news/industry"）で active カテゴリを検索。
 * テンプレ反映時に「年収」カテゴリを自動割り当てする等に使う。
 */
export async function findCategoryBySlugPathClient(
  slugPath: string
): Promise<{
  id: string;
  slug_path: string;
  name_path: string;
} | null> {
  const { listCategoriesForSelector } = await import("./get-categories");
  const all = await listCategoriesForSelector();
  const found = all.find((c) => c.slug_path === slugPath);
  if (!found) return null;
  return {
    id: found.id,
    slug_path: found.slug_path,
    name_path: found.name_path,
  };
}

// =====================================================================
// helper
// =====================================================================

async function isDescendant(
  sb: ReturnType<typeof createSupabaseAdminClient>,
  candidateParentId: string,
  ofId: string
): Promise<boolean> {
  // candidateParentId をたどって ofId に到達するか
  // = candidateParentId は ofId の子孫か
  let cursor: string | null = candidateParentId;
  const visited = new Set<string>();
  while (cursor) {
    if (visited.has(cursor)) return false; // safety
    visited.add(cursor);
    const r = await sb
      .from("article_categories")
      .select("parent_id")
      .eq("id", cursor)
      .maybeSingle();
    const parent = (r.data?.parent_id ?? null) as string | null;
    if (!parent) return false;
    if (parent === ofId) return true;
    cursor = parent;
  }
  return false;
}
