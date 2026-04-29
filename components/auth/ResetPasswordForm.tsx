"use client";

import { useActionState } from "react";
import { resetPassword, type ActionResult } from "@/lib/auth/actions";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "./AuthFormFields";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    resetPassword,
    null
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-4">
      <FieldRow
        label="新しいパスワード"
        htmlFor="password"
        errors={fieldErrors.password}
        hint="8文字以上"
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </FieldRow>
      <FieldRow
        label="確認用にもう一度"
        htmlFor="passwordConfirm"
        errors={fieldErrors.passwordConfirm}
      >
        <TextInput
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </FieldRow>
      {state && !state.ok && <FormMessage error={state.error} />}
      <SubmitButton label="パスワードを更新する" pendingLabel="更新中…" />
    </form>
  );
}
