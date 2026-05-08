import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ArticleAuthor = {
  id: string;
  slug: string;
  name: string;
  name_kana: string | null;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

/** 管理画面の一覧用：非公開も含めて全件 */
export async function listAuthorsForAdmin(): Promise<ArticleAuthor[]> {
  const sb = createSupabaseAdminClient();
  const res = await sb
    .from("article_authors")
    .select(
      `id, slug, name, name_kana, title, bio, avatar_url, is_active,
       display_order, created_at, updated_at`
    )
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (res.error) throw res.error;
  return (res.data ?? []) as ArticleAuthor[];
}

/** エディタの著者セレクタ用：active のみの軽量データ */
export async function listAuthorsForSelector(): Promise<
  Pick<ArticleAuthor, "id" | "name" | "title" | "avatar_url">[]
> {
  const sb = createSupabaseAdminClient();
  const res = await sb
    .from("article_authors")
    .select("id, name, title, avatar_url")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (res.error) throw res.error;
  return res.data ?? [];
}

export async function getAuthorById(
  id: string
): Promise<ArticleAuthor | null> {
  const sb = createSupabaseAdminClient();
  const res = await sb
    .from("article_authors")
    .select(
      `id, slug, name, name_kana, title, bio, avatar_url, is_active,
       display_order, created_at, updated_at`
    )
    .eq("id", id)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as ArticleAuthor;
}
