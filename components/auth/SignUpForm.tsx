"use client";

import { useActionState } from "react";
import { signUpWithEmail, type ActionResult } from "@/lib/auth/actions";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "./AuthFormFields";

export function SignUpForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    signUpWithEmail,
    null
  );
  const fieldErrors =
    state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-4">
      <FieldRow
        label="表示名"
        htmlFor="displayName"
        errors={fieldErrors.displayName}
        hint="マイページや投稿で使われる名前。後から変更できます。"
      >
        <TextInput
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="nickname"
          maxLength={50}
        />
      </FieldRow>
      <FieldRow
        label="メールアドレス"
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
      <FieldRow
        label="パスワード"
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
      {state && !state.ok && <FormMessage error={state.error} />}
      <SubmitButton label="会員登録" pendingLabel="送信中…" />
    </form>
  );
}
