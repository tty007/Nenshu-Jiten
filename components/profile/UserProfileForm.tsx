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
      <p className="rounded-lg border border-surface-border bg-surface-soft/40 p-3 text-xs leading-relaxed text-ink-muted">
        以下の属性はすべて任意です。入力いただいた情報は、業界平均との比較表示や、同意いただいた場合の記事レコメンド・広告のパーソナライズに利用します。広告利用に関する同意は<a
          href="/mypage"
          className="text-brand hover:underline"
        >マイページ</a>からいつでも変更できます。
      </p>
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
        hint="任意。年単位のみ収集します（誕生日は不要）。年代別の年収比較や同年代向けの記事レコメンドに利用します。"
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
        hint="任意。自己申告。男女別の賃金差データ表示や属性別の統計集計に利用します。"
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
        hint="任意。市区町村以下は収集しません。地域別の年収相場表示や近隣求人系コンテンツのレコメンドに利用します。"
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
        hint="任意。学生か社会人かで、表示する記事や比較対象を最適化します。"
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
        hint="任意。レンジから選択（金額単位は収集しません）。同水準・上位水準の企業比較や転職系コンテンツのレコメンドに利用します。"
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
