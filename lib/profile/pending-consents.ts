import "server-only";
import { cookies } from "next/headers";
import { CONSENT_TYPES, type ConsentType } from "./consents";

/**
 * サインアップ画面で取得した同意チェックを、登録〜OAuth コールバック完了まで
 * 短期保管する Cookie。
 *
 * - メール登録：signUpWithEmail がサインアップ成功直後に読み出して適用 → 削除
 * - Google OAuth：/auth/callback で OAuth セッション交換成功後に読み出して適用 → 削除
 *
 * Cookie 寿命を 10 分に絞ることで、放置されたチェック状態が他人のセッションへ
 * 漏れる事故を抑える。
 */

export const PENDING_CONSENTS_COOKIE = "pending_consents";
const TTL_SECONDS = 60 * 10;

export type PendingConsents = Partial<Record<ConsentType, boolean>>;

function safeParse(raw: string | undefined): PendingConsents {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: PendingConsents = {};
    for (const t of CONSENT_TYPES) {
      const v = obj[t];
      if (typeof v === "boolean") out[t] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function getPendingConsents(): Promise<PendingConsents> {
  const c = await cookies();
  return safeParse(c.get(PENDING_CONSENTS_COOKIE)?.value);
}

export async function mergePendingConsent(
  patch: PendingConsents
): Promise<void> {
  const current = await getPendingConsents();
  const next = { ...current, ...patch };
  const c = await cookies();
  c.set(PENDING_CONSENTS_COOKIE, JSON.stringify(next), {
    maxAge: TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function clearPendingConsents(): Promise<void> {
  const c = await cookies();
  c.set(PENDING_CONSENTS_COOKIE, "", { maxAge: 0, path: "/" });
}
