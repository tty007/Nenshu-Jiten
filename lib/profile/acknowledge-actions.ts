"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import { CURRENT_POLICY_VERSION } from "./consents";

/**
 * 指定ユーザに対して「最新ポリシーを確認した」記録を書く内部関数。
 * 再同意モーダル / サインアップ完了 / OAuth コールバック から呼ばれる。
 */
export async function recordPolicyAcknowledgement(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("user_policy_acknowledgements").upsert(
    {
      user_id: userId,
      policy_version: CURRENT_POLICY_VERSION,
      acknowledged_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

/**
 * 再同意モーダルの「同意して続ける」ボタンから呼ばれる server action。
 * セッションの uid を強制し、他人のレコードを書き換えさせない。
 */
export async function acknowledgeCurrentPolicy(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await recordPolicyAcknowledgement(user.id);
  revalidatePath("/", "layout");
}
