"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { toggleConsent } from "@/lib/profile/consent-actions";
import {
  CONSENT_META,
  CONSENT_TYPES,
  type ConsentState,
  type ConsentType,
} from "@/lib/profile/consents";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * マイページの「通知・配信設定」セクション。
 * 4 種類の同意トグルを並べ、行ごとに個別の form action で server に送信する。
 *
 * 楽観的 UI：トグル直後に見た目を反転させ、失敗時にサーバの確定値で上書きする。
 */
export function ConsentToggles({ initial }: { initial: ConsentState }) {
  const [state, setState] = useOptimistic<ConsentState, Partial<ConsentState>>(
    initial,
    (cur, patch) => ({ ...cur, ...patch })
  );
  return (
    <div className="divide-y divide-surface-border">
      {CONSENT_TYPES.map((type) => (
        <ConsentRow
          key={type}
          type={type}
          granted={state[type]}
          onToggle={(next) => setState({ [type]: next } as Partial<ConsentState>)}
        />
      ))}
    </div>
  );
}

function ConsentRow({
  type,
  granted,
  onToggle,
}: {
  type: ConsentType;
  granted: boolean;
  onToggle: (next: boolean) => void;
}) {
  const meta = CONSENT_META[type];
  const [, formAction] = useActionState<ActionResult | null, FormData>(
    toggleConsent,
    null
  );
  const [isPending, startTransition] = useTransition();
  // useOptimistic は transition の中でしか呼べない
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.currentTarget.checked;
    const fd = new FormData();
    fd.set("consentType", type);
    fd.set("granted", next ? "true" : "false");
    startTransition(() => {
      onToggle(next);
      formAction(fd);
    });
  }
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{meta.label}</p>
        <p className="mt-1 text-sm text-ink-muted">{meta.description}</p>
      </div>
      <label className="mt-0.5 inline-flex shrink-0 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          role="switch"
          checked={granted}
          onChange={handleChange}
          disabled={isPending}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative h-6 w-11 rounded-full bg-surface-border transition-colors peer-checked:bg-brand-600 peer-disabled:opacity-60"
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              granted ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
        <span className="text-xs font-medium text-ink-muted w-8 text-right">
          {granted ? "ON" : "OFF"}
        </span>
      </label>
    </div>
  );
}

/** ページ側で読みやすいよう、見出し付きカードラッパも一緒に提供 */
export function ConsentTogglesCard({ initial }: { initial: ConsentState }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
      <h2 className="text-base font-semibold text-ink">通知・広告配信の設定</h2>
      <p className="mt-1 text-sm text-ink-muted">
        いつでもこの画面から ON / OFF を変更できます。OFF にしても、サービスの利用には影響しません。
      </p>
      <div className="mt-4">
        <ConsentToggles initial={initial} />
      </div>
    </div>
  );
}
