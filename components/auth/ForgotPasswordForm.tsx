"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ActionResult } from "@/lib/auth/actions";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "./AuthFormFields";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    requestPasswordReset,
    null
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-4">
      <FieldRow
        label="登録済みメールアドレス"
        htmlFor="email"
        errors={fieldErrors.email}
      >
        <TextInput
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </FieldRow>
      <FormMessage
        ok={state?.ok}
        error={state && !state.ok ? state.error : undefined}
        message={state?.ok ? state.message : undefined}
      />
      <SubmitButton label="リセット用メールを送信" pendingLabel="送信中…" />
    </form>
  );
}
