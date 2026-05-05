"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";

export type FavoriteResult =
  | { ok: true; isFavorited: boolean }
  | { ok: false; error: "unauth" | "db" | "invalid" };

/**
 * お気に入りの追加・削除をトグルする。
 * - companyId はサーバー側で edinetCode から解決して RLS と整合させる
 */
export async function toggleFavorite(
  companyId: string,
  edinetCode: string
): Promise<FavoriteResult> {
  if (!companyId) return { ok: false, error: "invalid" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauth" };

  const sb = await createSupabaseServerClient();

  // 現状を確認
  const { data: existing } = await sb
    .from("user_favorites")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: "db" };
    revalidatePath("/mypage/favorites");
    revalidatePath(`/companies/${edinetCode}`);
    return { ok: true, isFavorited: false };
  }

  const { error } = await sb
    .from("user_favorites")
    .insert({ user_id: user.id, company_id: companyId });
  if (error) return { ok: false, error: "db" };
  revalidatePath("/mypage/favorites");
  revalidatePath(`/companies/${edinetCode}`);
  return { ok: true, isFavorited: true };
}
