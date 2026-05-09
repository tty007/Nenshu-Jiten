"use server";

import {
  CONSENT_TYPES,
  type ConsentType,
} from "./consents";
import { mergePendingConsent } from "./pending-consents";

function isConsentType(v: unknown): v is ConsentType {
  return typeof v === "string" && (CONSENT_TYPES as readonly string[]).includes(v);
}

/**
 * サインアップ画面のチェックボックスが ON / OFF された都度呼ばれる。
 * Cookie に書き込むだけで、DB には触れない（ユーザーがまだ存在しないため）。
 */
export async function setPendingConsentFlag(formData: FormData): Promise<void> {
  const type = formData.get("consentType");
  const granted = formData.get("granted");
  if (!isConsentType(type)) return;
  await mergePendingConsent({ [type]: granted === "true" });
}
