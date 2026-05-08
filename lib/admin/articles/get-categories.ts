import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ArticleCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ArticleCategoryWithPath = ArticleCategory & {
  /** ルートからのスラグパス。例: "news/industry" */
  slug_path: string;
  /** ルートからの名前パス。例: "ニュース / 業界動向" */
  name_path: string;
  /** 階層深さ（0 がトップレベル） */
  depth: number;
};

/** 管理画面用：全件（非公開含む） */
export async function listCategoriesForAdmin(): Promise<ArticleCategoryWithPath[]> {
  const sb = createSupabaseAdminClient();
  const res = await sb
    .from("article_categories")
    .select(
      "id, parent_id, slug, name, description, display_order, is_active, created_at, updated_at"
    )
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (res.error) throw res.error;
  return decorateWithPath((res.data ?? []) as ArticleCategory[]);
}

/** エディタのカテゴリセレクタ用：active のみ */
export async function listCategoriesForSelector(): Promise<
  Pick<ArticleCategoryWithPath, "id" | "slug" | "name" | "slug_path" | "name_path" | "depth" | "parent_id">[]
> {
  const sb = createSupabaseAdminClient();
  const res = await sb
    .from("article_categories")
    .select("id, parent_id, slug, name, description, display_order, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (res.error) throw res.error;
  const decorated = decorateWithPath((res.data ?? []) as ArticleCategory[]);
  return decorated.map((c) => ({
    id: c.id,
    parent_id: c.parent_id,
    slug: c.slug,
    name: c.name,
    slug_path: c.slug_path,
    name_path: c.name_path,
    depth: c.depth,
  }));
}

export async function getCategoryById(
  id: string
): Promise<ArticleCategoryWithPath | null> {
  const all = await listCategoriesForAdmin();
  return all.find((c) => c.id === id) ?? null;
}

/** 階層用に slug_path / name_path / depth を計算して付与 */
function decorateWithPath(rows: ArticleCategory[]): ArticleCategoryWithPath[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  function pathFor(id: string, kind: "slug" | "name"): string[] {
    const node = byId.get(id);
    if (!node) return [];
    const me = kind === "slug" ? node.slug : node.name;
    if (!node.parent_id) return [me];
    return [...pathFor(node.parent_id, kind), me];
  }
  function depthFor(id: string): number {
    const node = byId.get(id);
    if (!node || !node.parent_id) return 0;
    return 1 + depthFor(node.parent_id);
  }
  // 階層順（DFS）に並べる
  const childrenByParent = new Map<string | null, ArticleCategory[]>();
  for (const r of rows) {
    const k = r.parent_id ?? null;
    if (!childrenByParent.has(k)) childrenByParent.set(k, []);
    childrenByParent.get(k)!.push(r);
  }
  const sorted: ArticleCategory[] = [];
  function dfs(parentId: string | null) {
    const list = childrenByParent.get(parentId) ?? [];
    for (const c of list) {
      sorted.push(c);
      dfs(c.id);
    }
  }
  dfs(null);
  return sorted.map((c) => ({
    ...c,
    slug_path: pathFor(c.id, "slug").join("/"),
    name_path: pathFor(c.id, "name").join(" / "),
    depth: depthFor(c.id),
  }));
}
