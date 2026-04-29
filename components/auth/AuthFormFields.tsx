"use client";

import { useFormStatus } from "react-dom";

export function FieldRow({
  label,
  htmlFor,
  errors,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-sm text-ink-subtle">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="mt-1 text-sm text-negative-600">
          {e}
        </p>
      ))}
    </div>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={`block w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${props.className ?? ""}`}
    />
  );
}

export function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel ?? "処理中…" : label}
    </button>
  );
}

export function FormMessage({
  ok,
  error,
  message,
}: {
  ok?: boolean;
  error?: string;
  message?: string;
}) {
  if (error) {
    return (
      <p className="rounded-md border border-negative/30 bg-negative-50 px-3 py-2 text-sm text-negative-600">
        {error}
      </p>
    );
  }
  if (ok && message) {
    return (
      <p className="rounded-md border border-positive/30 bg-positive-50 px-3 py-2 text-sm text-positive-600">
        {message}
      </p>
    );
  }
  return null;
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-surface-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-sm text-ink-subtle">{label}</span>
      </div>
    </div>
  );
}
