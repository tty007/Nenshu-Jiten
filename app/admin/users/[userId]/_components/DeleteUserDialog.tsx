"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, X } from "lucide-react";
import { adminDeleteUser } from "@/lib/admin/actions";
import { toast } from "@/lib/toast";

const TRANSITION_MS = 180;

type Props = {
  userId: string;
  email: string;
};

export function DeleteUserDialog({ userId, email }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function open() {
    setConfirmEmail("");
    setMounted(true);
  }
  function close() {
    if (pending) return;
    setShown(false);
    window.setTimeout(() => setMounted(false), TRANSITION_MS);
  }

  useEffect(() => {
    if (!mounted) return;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pending]);

  const matches =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  function onDelete() {
    if (!matches || pending) return;
    const loadingId = toast.loading("削除中…");
    startTransition(async () => {
      const res = await adminDeleteUser(userId, confirmEmail);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("ユーザーを削除しました");
      close();
      router.push("/admin/users");
      router.refresh();
      void loadingId;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-negative/30 bg-white px-4 py-2 text-sm font-semibold text-negative-600 hover:bg-negative-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        ユーザーを削除
      </button>
      {mounted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
        >
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out ${
              shown ? "opacity-100" : "opacity-0"
            }`}
            onClick={close}
            aria-hidden
          />
          <div
            className={`relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-200 ease-out ${
              shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-border bg-white px-6 py-4">
              <h2 id="delete-user-title" className="text-base font-semibold text-negative-600">
                ユーザーを削除
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                aria-label="閉じる"
                className="-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-6 py-5 text-sm">
              <p className="text-ink">
                このユーザーと関連データ（プロフィール、お気に入り）を <strong>完全に削除</strong> します。
                この操作は取り消せません。
              </p>
              <div className="rounded-md bg-surface-muted/60 px-3 py-2 font-numeric text-xs text-ink-muted">
                <p className="break-all">id: {userId}</p>
                <p className="break-all">email: {email}</p>
              </div>
              <div>
                <label
                  htmlFor="confirm-email"
                  className="block text-sm font-medium text-ink"
                >
                  確認のため、対象の email を入力してください
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  autoComplete="off"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={email}
                  className="mt-1.5 block w-full rounded-md border border-surface-border bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-surface-border bg-white px-6 py-4">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={!matches || pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-negative-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    削除中…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    完全に削除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
