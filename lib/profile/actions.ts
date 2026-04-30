"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import type { ActionResult } from "@/lib/auth/actions";
import { parseUserProfileFormData } from "./schemas";

export async function updateUserProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const parsed = parseUserProfileFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("user_profiles").upsert(
    {
      user_id: user.id,
      nickname: parsed.data.nickname,
      birth_year: parsed.data.birthYear,
      gender: parsed.data.gender,
      prefecture: parsed.data.prefecture,
      career_status: parsed.data.careerStatus,
      salary_band: parsed.data.salaryBand,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mypage");
  revalidatePath("/mypage/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "プロフィールを更新しました" };
}
