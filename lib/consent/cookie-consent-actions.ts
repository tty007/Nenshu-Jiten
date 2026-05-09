"use server";

import { revalidatePath } from "next/cache";
import {
  COOKIE_CONSENT_PRESETS,
  writeCookieConsent,
} from "./cookie-consent";

/** バナーの「すべて許可」ボタン用 */
export async function acceptAllCookies(): Promise<void> {
  await writeCookieConsent(COOKIE_CONSENT_PRESETS.acceptAll);
  // Analytics 等の有無を切替えるため、layout から再描画させる
  revalidatePath("/", "layout");
}

/** バナーの「必須のみ」ボタン用 */
export async function rejectOptionalCookies(): Promise<void> {
  await writeCookieConsent(COOKIE_CONSENT_PRESETS.rejectAll);
  revalidatePath("/", "layout");
}

/** バナーの「カスタム」保存・後からフッターから設定変更したとき用 */
export async function saveCookiePreferences(formData: FormData): Promise<void> {
  const analytics = formData.get("analytics") === "on";
  const ads = formData.get("ads") === "on";
  await writeCookieConsent({ analytics, ads });
  revalidatePath("/", "layout");
}
