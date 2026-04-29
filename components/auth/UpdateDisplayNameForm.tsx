"use client";

import { useActionState } from "react";
import {
  updateDisplayName,
  type ActionResult,
} from "@/lib/auth/actions";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "./AuthFormFields";

export function UpdateDisplayNameForm({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateDisplayName,
    null
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-3">
      <FieldRow
        label="表示名"
        htmlFor="displayName"
        errors={fieldErrors.displayName}
      >
        <TextInput
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={defaultValue}
          required
          maxLength={50}
        />
      </FieldRow>
      <FormMessage
        ok={state?.ok}
        error={state && !state.ok ? state.error : undefined}
        message={state?.ok ? state.message : undefined}
      />
      <SubmitButton label="表示名を更新" pendingLabel="更新中…" />
    </form>
  );
}
