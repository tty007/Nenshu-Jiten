"use client";

import { useState, useTransition } from "react";
import {
  CONSENT_META,
  CONSENT_TYPES,
  DEFAULT_CONSENT_STATE,
  type ConsentType,
} from "@/lib/profile/consents";
import { setPendingConsentFlag } from "@/lib/profile/pending-consents-actions";

/**
 * サインアップ画面の最上部に配置する「広告配信に関する任意の同意」パネル。
 *
 * チェック変更ごとに server action で `pending_consents` Cookie を更新する。
 * メール登録・Google OAuth どちらの経路でもサインアップ完了後にこの Cookie を
 * 読み取り、`user_consents` に反映する。
 *
 * - すべて任意。チェックが全部 OFF でも会員登録は可能。
 * - 同じパネルから後で（マイページ）変更できることを明示。
 */
export function ConsentCheckboxes({
  initial = {},
}: {
  initial?: Partial<Record<ConsentType, boolean>>;
}) {
  // Cookie に明示の値があれば優先、なければ DEFAULT_CONSENT_STATE
  // （personalized_ads のみ ON）を採用する。
  const [state, setState] = useState<Record<ConsentType, boolean>>(() => {
    const init = {} as Record<ConsentType, boolean>;
    for (const t of CONSENT_TYPES) {
      init[t] = typeof initial[t] === "boolean" ? !!initial[t] : DEFAULT_CONSENT_STATE[t];
    }
    return init;
  });
  const [isPending, startTransition] = useTransition();

  function handleChange(type: ConsentType, next: boolean) {
    setState((s) => ({ ...s, [type]: next }));
    const fd = new FormData();
    fd.set("consentType", type);
    fd.set("granted", next ? "true" : "false");
    startTransition(() => {
      setPendingConsentFlag(fd);
    });
  }

  return (
    <fieldset className="rounded-xl border border-surface-border bg-surface-soft/50 p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        広告配信に関する任意の同意
      </legend>
      <p className="mt-1 text-sm text-ink-muted">
        以下は任意です。マイページの「通知・広告配信の設定」からいつでも変更できます。
      </p>
      <div className="mt-3 space-y-3">
        {CONSENT_TYPES.map((type) => {
          const meta = CONSENT_META[type];
          const id = `consent-${type}`;
          return (
            <label
              key={type}
              htmlFor={id}
              className="flex items-start gap-3 rounded-lg border border-transparent p-2 hover:border-surface-border"
            >
              <input
                id={id}
                type="checkbox"
                checked={state[type]}
                disabled={isPending}
                onChange={(e) => handleChange(type, e.currentTarget.checked)}
                className="mt-0.5 h-4 w-4 rounded border-surface-border text-brand-600 focus:ring-brand/20"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">{meta.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                  {meta.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
