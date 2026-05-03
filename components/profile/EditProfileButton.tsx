"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { UserProfile } from "@/lib/profile/get-user-profile";
import { UserProfileForm } from "./UserProfileForm";

// Tailwind の `duration-200` と一致させる（JIT が静的に拾える固定クラス名を使う）。
const TRANSITION_MS = 200;

export function EditProfileButton({
  initial,
}: {
  initial: UserProfile | null;
}) {
  const [mounted, setMounted] = useState(false); // DOM 上に存在するか
  const [shown, setShown] = useState(false); // 表示状態（アニメ用）
  const router = useRouter();

  const open = () => {
    setMounted(true);
  };

  const close = () => {
    setShown(false);
    window.setTimeout(() => setMounted(false), TRANSITION_MS);
  };

  // mount 直後に shown=true へ切り替えてフェードイン
  useEffect(() => {
    if (!mounted) return;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
      >
        編集する
      </button>
      {mounted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out ${
              shown ? "opacity-100" : "opacity-0"
            }`}
            onClick={close}
            aria-hidden
          />
          <div
            className={`relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-200 ease-out ${
              shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-border bg-white px-6 py-4 sm:px-8">
              <h2
                id="edit-profile-title"
                className="text-base font-semibold text-ink"
              >
                プロフィール属性を編集
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="閉じる"
                className="-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6 sm:px-8">
              <UserProfileForm
                initial={initial}
                onSuccess={() => {
                  close();
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
