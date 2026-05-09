// エージェント生成記事のデフォルト著者解決。
// slug='editorial' (年収辞典編集部) を 1 度だけ DB から引いてキャッシュする。

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_AUTHOR_SLUG = "editorial";

let cached: { id: string; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000; // 5分

/**
 * デフォルト著者 (slug='editorial') の id を返す。
 * ロード失敗時は null を返し、呼び出し側で「著者なし (null)」運用を継続できる。
 */
export async function resolveDefaultAuthorId(
  sb: SupabaseClient
): Promise<string | null> {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.id;
  }
  const r = await sb
    .from("article_authors")
    .select("id")
    .eq("slug", DEFAULT_AUTHOR_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (r.error) {
    console.warn(
      `[default-author] lookup error: ${r.error.message}`
    );
    return null;
  }
  if (!r.data) {
    console.warn(
      `[default-author] slug='${DEFAULT_AUTHOR_SLUG}' が DB に見つかりません`
    );
    return null;
  }
  cached = {
    id: (r.data as { id: string }).id,
    loadedAt: Date.now(),
  };
  return cached.id;
}
