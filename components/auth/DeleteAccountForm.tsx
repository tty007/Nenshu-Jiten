"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccount } from "@/lib/auth/actions";

export function DeleteAccountForm() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        退会すると、アカウント・プロフィール情報・関連データが削除されます。元に戻すことはできません。
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1 rounded-md border border-negative/40 bg-white px-4 py-2 text-sm font-medium text-negative-600 hover:bg-negative-50"
        >
          退会する
        </button>
      ) : (
        <form action={deleteAccount} className="flex flex-wrap gap-3">
          <DeleteSubmitButton />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            キャンセル
          </button>
        </form>
      )}
    </div>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md bg-negative px-4 py-2 text-sm font-semibold text-white hover:bg-negative-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "退会処理中…" : "本当に退会する"}
    </button>
  );
}
