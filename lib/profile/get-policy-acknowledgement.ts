import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { CURRENT_POLICY_VERSION } from "./consents";

/**
 * ログイン中ユーザが最後に確認したポリシー版を返す。未確認なら null。
 */
export const getMyPolicyAcknowledgement = cache(
  async (): Promise<string | null> => {
    const user = await getCurrentUser();
    if (!user) return null;
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("user_policy_acknowledgements")
      .select("policy_version")
      .eq("user_id", user.id)
      .maybeSingle();
    return (data?.policy_version as string | undefined) ?? null;
  }
);

/**
 * 再同意モーダルを出すべきかを判定。
 * - 未ログイン：false（サインアップ時のチェックで取得済みのため）
 * - 既存ユーザで policy_version が現行と一致：false
 * - その他（未確認 / 旧版）：true
 */
export const shouldShowReacknowledgement = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const acked = await getMyPolicyAcknowledgement();
  return acked !== CURRENT_POLICY_VERSION;
});
