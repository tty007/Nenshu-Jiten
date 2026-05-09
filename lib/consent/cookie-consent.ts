import "server-only";
import { cookies } from "next/headers";

/**
 * Cookie 同意バナーの状態管理。
 *
 * 改正電気通信事業法 第27条の12（外部送信規律）に基づき、解析・広告タグの
 * ロード可否をユーザの同意状態でゲートする。Cookie に保存して全リクエストで
 * 参照できるようにする。
 *
 * カテゴリ：
 *   - essential : セッション維持・CSRF 等。常時 true（ユーザは拒否不可）。
 *   - analytics : Vercel Analytics などの解析系。OFF なら一切ロードしない。
 *   - ads       : 第三者広告タグ（Phase 3 以降）。OFF なら一切ロードしない。
 *
 * Cookie 仕様：
 *   - name    : `cookie_consent`
 *   - value   : `v1:essential[,analytics][,ads]`
 *   - max-age : 365 日
 *   - path    : `/`
 *   - sameSite: `lax`（同サイトの遷移で確実に送信）
 */

export const COOKIE_CONSENT_NAME = "cookie_consent";
const COOKIE_VERSION = "v1";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type CookieConsentCategory = "essential" | "analytics" | "ads";

export type CookieConsentState = {
  decided: boolean;
  essential: true; // 常時 true（型レベルで保証）
  analytics: boolean;
  ads: boolean;
};

const UNDECIDED: CookieConsentState = {
  decided: false,
  essential: true,
  analytics: false,
  ads: false,
};

/** Cookie 文字列からパース。未設定 / 不正な値は UNDECIDED 扱い */
export function parseCookieConsentValue(raw: string | undefined): CookieConsentState {
  if (!raw) return { ...UNDECIDED };
  const [version, list] = raw.split(":");
  if (version !== COOKIE_VERSION) return { ...UNDECIDED };
  const set = new Set((list ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return {
    decided: true,
    essential: true,
    analytics: set.has("analytics"),
    ads: set.has("ads"),
  };
}

/** Cookie 文字列にエンコード */
export function encodeCookieConsentValue(state: Pick<CookieConsentState, "analytics" | "ads">): string {
  const parts: CookieConsentCategory[] = ["essential"];
  if (state.analytics) parts.push("analytics");
  if (state.ads) parts.push("ads");
  return `${COOKIE_VERSION}:${parts.join(",")}`;
}

export async function getCookieConsent(): Promise<CookieConsentState> {
  const c = await cookies();
  return parseCookieConsentValue(c.get(COOKIE_CONSENT_NAME)?.value);
}

export async function writeCookieConsent(state: {
  analytics: boolean;
  ads: boolean;
}): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_CONSENT_NAME, encodeCookieConsentValue(state), {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // クライアントからも判定したいケースに備える
  });
}

export const COOKIE_CONSENT_PRESETS = {
  acceptAll: { analytics: true, ads: true },
  rejectAll: { analytics: false, ads: false },
} as const;
