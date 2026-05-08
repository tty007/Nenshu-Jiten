"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import type { ActionResult } from "@/lib/auth/actions";
import {
  CONSENT_TYPES,
  CURRENT_POLICY_VERSION,
  type ConsentType,
} from "./consents";

type ConsentSource = "signup" | "mypage" | "reconsent_modal" | "admin";

function isConsentType(v: unknown): v is ConsentType {
  return typeof v === "string" && (CONSENT_TYPES as readonly string[]).includes(v);
}

function isConsentSource(v: unknown): v is ConsentSource {
  return (
    v === "signup" || v === "mypage" || v === "reconsent_modal" || v === "admin"
  );
}

/**
 * 単一の同意状態を更新する。
 *
 * - granted=true / false いずれの場合も user_consents の現在状態を upsert し、
 *   user_consent_logs に append-only で履歴を残す（監査要件）。
 * - 書き込みは管理クライアント（service_role）で行うが、対象ユーザは
 *   セッションから取得した uid に必ず固定する（他人の同意状態を書き換えられない）。
 */
async function setConsentInternal(
  userId: string,
  type: ConsentType,
  granted: boolean,
  source: ConsentSource
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error: upsertError } = await admin.from("user_consents").upsert(
    {
      user_id: userId,
      consent_type: type,
      granted,
      granted_at: granted ? now : undefined,
      revoked_at: granted ? null : now,
      policy_version: CURRENT_POLICY_VERSION,
      source,
    },
    { onConflict: "user_id,consent_type" }
  );
  if (upsertError) return { ok: false, error: upsertError.message };

  const { error: logError } = await admin.from("user_consent_logs").insert({
    user_id: userId,
    consent_type: type,
    action: granted ? "granted" : "revoked",
    policy_version: CURRENT_POLICY_VERSION,
    source,
  });
  if (logError) return { ok: false, error: logError.message };

  return { ok: true };
}

/** マイページの同意トグル UI から呼ばれる server action */
export async function toggleConsent(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const rawType = formData.get("consentType");
  const rawGranted = formData.get("granted");
  if (!isConsentType(rawType)) {
    return { ok: false, error: "同意項目が不正です" };
  }
  const granted = rawGranted === "true" || rawGranted === "on" || rawGranted === "1";

  const res = await setConsentInternal(user.id, rawType, granted, "mypage");
  if (!res.ok) return res;

  revalidatePath("/mypage");
  revalidatePath("/mypage/settings");
  return {
    ok: true,
    message: granted ? "同意を保存しました" : "同意を撤回しました",
  };
}

/**
 * サインアップ完了直後に呼ぶ用（form action ではなくサーバ内直呼び）。
 * 失敗してもサインアップ自体は通すため、戻り値は監査・ログ用。
 */
export async function recordInitialConsents(
  userId: string,
  consents: Partial<Record<ConsentType, boolean>>,
  source: ConsentSource = "signup"
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const type of CONSENT_TYPES) {
    const v = consents[type];
    if (typeof v !== "boolean") continue;
    const res = await setConsentInternal(userId, type, v, source);
    if (!res.ok) return res;
  }
  return { ok: true };
}

/**
 * 受け取った FormData から、CONSENT_TYPES に該当するチェック状態を抽出。
 * サインアップ・マイページ等で共通して使う。
 *
 * チェックボックスは `name="consent.<type>"` で送信する想定。
 */
export function extractConsentFlagsFromFormData(
  formData: FormData
): Partial<Record<ConsentType, boolean>> {
  const out: Partial<Record<ConsentType, boolean>> = {};
  for (const type of CONSENT_TYPES) {
    const v = formData.get(`consent.${type}`);
    out[type] = v === "on" || v === "true" || v === "1";
  }
  return out;
}

// `isConsentSource` は将来 source 引数を外部入力にする際の検証用に export
export { isConsentSource };
