"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInWithEmail, type ActionResult } from "@/lib/auth/actions";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "./AuthFormFields";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    signInWithEmail,
    null
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </FieldRow>
      <div className="flex justify-end">
        <Link
          href="/auth/forgot-password"
          className="text-sm text-brand hover:text-brand-700"
        >
          パスワードを忘れた
        </Link>
      </div>
      {state && !state.ok && <FormMessage error={state.error} />}
      <SubmitButton label="ログイン" pendingLabel="ログイン中…" />
    </form>
  );
}
