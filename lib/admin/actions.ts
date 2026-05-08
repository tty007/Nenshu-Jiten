"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import {
  getAdminUserDetail,
  type AdminUserDetail,
} from "./get-admin-users";
import {
  getAdminCompanyDetail,
  type AdminCompanyDetail,
} from "./get-admin-company-detail";

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * モーダルで開いた時に詳細を取得する。admin 判定込み。
 */
export async function fetchAdminUserDetail(
  userId: string
): Promise<
  { ok: true; data: AdminUserDetail } | { ok: false; error: string }
> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  const detail = await getAdminUserDetail(userId);
  if (!detail) return { ok: false, error: "ユーザーが見つかりません" };
  return { ok: true, data: detail };
}

/**
 * 企業モーダル：1 社の詳細データ集計を取得。
 */
export async function fetchAdminCompanyDetail(
  companyId: string
): Promise<
  { ok: true; data: AdminCompanyDetail } | { ok: false; error: string }
> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  const detail = await getAdminCompanyDetail(companyId);
  if (!detail) return { ok: false, error: "企業が見つかりません" };
  return { ok: true, data: detail };
}

/**
 * 管理者によるユーザー削除。
 * - 二段確認は client コンポーネント側 (DeleteUserDialog) で「対象 email 再入力」を強制する
 * - サーバー側でも email 一致を検証して、URL 直叩きでの誤操作を防ぐ
 * - 削除前に user_profiles + favorites を JSON で console.log（簡易 audit）
 */
export async function adminDeleteUser(
  userId: string,
  confirmEmail: string
): Promise<AdminActionResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  if (!userId || !confirmEmail) {
    return { ok: false, error: "userId と email が必要です" };
  }

  const sb = createSupabaseAdminClient();
  const { data: target, error: fetchErr } = await sb.auth.admin.getUserById(
    userId
  );
  if (fetchErr || !target.user) {
    return { ok: false, error: "対象ユーザーが見つかりません" };
  }
  const targetEmail = target.user.email?.trim().toLowerCase();
  const provided = confirmEmail.trim().toLowerCase();
  if (!targetEmail || targetEmail !== provided) {
    return { ok: false, error: "確認メールアドレスが一致しません" };
  }

  // 簡易 audit: 削除前に関連データをログ出力（Vercel ログに残る）
  try {
    const [profile, favorites] = await Promise.all([
      sb
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      sb.from("user_favorites").select("*").eq("user_id", userId),
    ]);
    console.log(
      "[admin] adminDeleteUser snapshot",
      JSON.stringify({
        deletedAt: new Date().toISOString(),
        userId,
        email: targetEmail,
        profile: profile.data,
        favoritesCount: favorites.data?.length ?? 0,
      })
    );
  } catch (e) {
    console.warn("[admin] failed to log snapshot:", (e as Error).message);
  }

  const { error: delErr } = await sb.auth.admin.deleteUser(userId);
  if (delErr) {
    return { ok: false, error: delErr.message };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, message: "削除しました" };
}
