"use client";

import { useActionState } from "react";
import { updatePassword, type ActionResult } from "@/lib/auth/actions";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "./AuthFormFields";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updatePassword,
    null
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-3">
      <FieldRow
        label="現在のパスワード"
        htmlFor="currentPassword"
        errors={fieldErrors.currentPassword}
      >
        <TextInput
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </FieldRow>
      <FieldRow
        label="新しいパスワード"
        htmlFor="newPassword"
        errors={fieldErrors.newPassword}
        hint="8文字以上"
      >
        <TextInput
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </FieldRow>
      <FieldRow
        label="確認用にもう一度"
        htmlFor="newPasswordConfirm"
        errors={fieldErrors.newPasswordConfirm}
      >
        <TextInput
          id="newPasswordConfirm"
          name="newPasswordConfirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </FieldRow>
      <FormMessage
        ok={state?.ok}
        error={state && !state.ok ? state.error : undefined}
        message={state?.ok ? state.message : undefined}
      />
      <SubmitButton label="パスワードを更新" pendingLabel="更新中…" />
    </form>
  );
}
