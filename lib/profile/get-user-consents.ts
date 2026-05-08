import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  CONSENT_TYPES,
  EMPTY_CONSENT_STATE,
  type ConsentState,
  type ConsentType,
} from "./consents";

/**
 * ログイン中ユーザの同意状態を返す。未設定の項目は false 扱い。
 * RLS により本人レコードのみ読める前提。
 */
export const getMyConsents = cache(async (): Promise<ConsentState> => {
  const user = await getCurrentUser();
  if (!user) return { ...EMPTY_CONSENT_STATE };
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("user_consents")
    .select("consent_type, granted")
    .eq("user_id", user.id);
  const state: ConsentState = { ...EMPTY_CONSENT_STATE };
  if (!data) return state;
  for (const row of data as Array<{ consent_type: string; granted: boolean }>) {
    if ((CONSENT_TYPES as readonly string[]).includes(row.consent_type)) {
      state[row.consent_type as ConsentType] = !!row.granted;
    }
  }
  return state;
});
