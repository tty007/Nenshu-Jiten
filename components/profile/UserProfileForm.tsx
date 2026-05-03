"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  CAREER_STATUSES,
  CAREER_STATUS_LABELS,
  GENDERS,
  GENDER_LABELS,
  PREFECTURES,
  SALARY_BANDS,
  SALARY_BAND_LABELS,
} from "@/lib/profile/schemas";
import { updateUserProfile } from "@/lib/profile/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type { UserProfile } from "@/lib/profile/get-user-profile";
import {
  FieldRow,
  FormMessage,
  SubmitButton,
  TextInput,
} from "@/components/auth/AuthFormFields";

const currentYear = new Date().getFullYear();
const minBirthYear = 1920;
const maxBirthYear = currentYear - 10;
const birthYears = Array.from(
  { length: maxBirthYear - minBirthYear + 1 },
  (_, i) => maxBirthYear - i
);

export function UserProfileForm({
  initial,
  onSuccess,
}: {
  initial: UserProfile | null;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateUserProfile,
    null
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  useEffect(() => {
    if (state?.ok) onSuccessRef.current?.();
  }, [state]);
  return (
    <form action={formAction} className="space-y-5">
      <FieldRow
        label="ニックネーム"
        htmlFor="nickname"
        errors={fieldErrors.nickname}
        hint="本名は使用しないでください（口コミ等で公開されます）。30文字以内"
      >
        <TextInput
          id="nickname"
          name="nickname"
          type="text"
          maxLength={30}
          autoComplete="nickname"
          defaultValue={initial?.nickname ?? ""}
        />
      </FieldRow>

      <FieldRow
        label="生まれ年"
        htmlFor="birthYear"
        errors={fieldErrors.birthYear}
        hint="任意。年単位のみ収集します（誕生日は不要）"
      >
        <Select
          id="birthYear"
          name="birthYear"
          defaultValue={initial?.birthYear?.toString() ?? ""}
        >
          <option value="">未選択</option>
          {birthYears.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </Select>
      </FieldRow>

      <FieldRow
        label="性別"
        htmlFor="gender"
        errors={fieldErrors.gender}
        hint="任意。自己申告"
      >
        <RadioGroup
          name="gender"
          options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
          defaultValue={initial?.gender ?? ""}
        />
      </FieldRow>

      <FieldRow
        label="現住所（都道府県）"
        htmlFor="prefecture"
        errors={fieldErrors.prefecture}
        hint="任意。市区町村以下は収集しません"
      >
        <Select
          id="prefecture"
          name="prefecture"
          defaultValue={initial?.prefecture ?? ""}
        >
          <option value="">未選択</option>
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </FieldRow>

      <FieldRow
        label="キャリアステータス"
        htmlFor="careerStatus"
        errors={fieldErrors.careerStatus}
        hint="任意"
      >
        <RadioGroup
          name="careerStatus"
          options={CAREER_STATUSES.map((c) => ({
            value: c,
            label: CAREER_STATUS_LABELS[c],
          }))}
          defaultValue={initial?.careerStatus ?? ""}
        />
      </FieldRow>

      <FieldRow
        label="現在の年収"
        htmlFor="salaryBand"
        errors={fieldErrors.salaryBand}
        hint="任意。区分（レンジ）から選択"
      >
        <Select
          id="salaryBand"
          name="salaryBand"
          defaultValue={initial?.salaryBand ?? ""}
        >
          <option value="">未選択</option>
          {SALARY_BANDS.map((s) => (
            <option key={s} value={s}>
              {SALARY_BAND_LABELS[s]}
            </option>
          ))}
        </Select>
      </FieldRow>

      {state && (
        <FormMessage
          ok={state.ok}
          error={state.ok ? undefined : state.error}
          message={state.ok ? state.message : undefined}
        />
      )}
      <SubmitButton label="保存する" pendingLabel="保存中…" />
    </form>
  );
}

function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`block w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className ?? ""}`}
    />
  );
}

function RadioGroup({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
      {options.map((o) => (
        <label
          key={o.value}
          className="inline-flex items-center gap-1.5 text-sm text-ink"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            className="h-4 w-4 border-surface-border text-brand-600 focus:ring-brand/20"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
