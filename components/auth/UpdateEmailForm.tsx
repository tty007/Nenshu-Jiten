"use client";

import { useActionState } from "react";
import { updateEmail, type ActionResult } from "@/lib/auth/actions";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "./AuthFormFields";

export function UpdateEmailForm({ defaultValue }: { defaultValue: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateEmail,
    null
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-3">
      <FieldRow
        label="新しいメールアドレス"
        htmlFor="email"
        errors={fieldErrors.email}
        hint="変更には新しいメールアドレスへの確認リンク承認が必要です。"
      >
        <TextInput
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValue}
          required
          autoComplete="email"
        />
      </FieldRow>
      <FormMessage
        ok={state?.ok}
        error={state && !state.ok ? state.error : undefined}
        message={state?.ok ? state.message : undefined}
      />
      <SubmitButton label="メールアドレスを更新" pendingLabel="送信中…" />
    </form>
  );
}
