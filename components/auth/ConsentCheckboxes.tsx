"use client";

import { CONSENT_META, CONSENT_TYPES } from "@/lib/profile/consents";

/**
 * 会員登録フォーム内に挿入する任意同意のチェックボックス群。
 *
 * - 規約 / プライバシーポリシーへの同意は登録ボタン押下＝同意の文面で別途取得しているため、
 *   ここでは「広告配信・マーケティング系の任意同意」のみを並べる。
 * - すべて任意（規約同意のように必須ではない）。チェックなしでも登録は可能。
 * - submit 後、`name="consent.<type>"` の値を server action 側で抽出する。
 */
export function ConsentCheckboxes() {
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
                name={`consent.${type}`}
                type="checkbox"
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
