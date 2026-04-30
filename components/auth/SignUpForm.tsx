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
        label="ニックネーム"
        htmlFor="displayName"
        errors={fieldErrors.displayName}
        hint="本名は使用しないでください。サイト内（口コミ等）で公開されます。30文字以内"
      >
        <TextInput
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="nickname"
          maxLength={30}
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
