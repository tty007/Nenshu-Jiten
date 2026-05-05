"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/favorites/actions";
import { dismissToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Variant = "hero" | "compact";

type Props = {
  companyId: string;
  edinetCode: string;
  initialIsFavorited: boolean;
  variant?: Variant;
  /** 未ログイン時の遷移先（戻り先） */
  returnTo?: string;
};

export function FavoriteButton({
  companyId,
  edinetCode,
  initialIsFavorited,
  variant = "hero",
  returnTo,
}: Props) {
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const willAdd = !isFavorited;
    const loadingId = toast.loading(
      willAdd ? "お気に入りに追加中…" : "お気に入りから削除中…"
    );
    startTransition(async () => {
      setIsFavorited(willAdd);
      const res = await toggleFavorite(companyId, edinetCode);
      dismissToast(loadingId);
      if (!res.ok) {
        // 失敗時はロールバック
        setIsFavorited(!willAdd);
        if (res.error === "unauth") {
          toast.info("ログインが必要です");
          const next = returnTo ?? `/companies/${edinetCode}`;
          router.push(`/auth/sign-in?next=${encodeURIComponent(next)}`);
        } else {
          toast.error("保存に失敗しました。時間をおいて再度お試しください。");
        }
        return;
      }
      setIsFavorited(res.isFavorited);
      toast.success(
        res.isFavorited
          ? "お気に入りに追加しました"
          : "お気に入りから削除しました"
      );
      router.refresh();
    });
  }

  const label = isFavorited ? "お気に入り解除" : "お気に入り追加";

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={isFavorited}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium backdrop-blur transition",
          "disabled:cursor-not-allowed disabled:opacity-60",
          isFavorited
            ? "border-rose-200/80 bg-rose-50/95 text-rose-600 hover:bg-rose-100"
            : "border-white/30 bg-white/15 text-white hover:bg-white/25"
        )}
      >
        <Heart
          className={cn("h-4 w-4", isFavorited && "fill-current")}
          aria-hidden
        />
        {isFavorited ? "保存中" : "お気に入り"}
      </button>
    );
  }

  // compact: 一覧カードや右上小ボタン用
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={isFavorited}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        isFavorited
          ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
          : "border-surface-border bg-white text-ink-muted hover:border-rose-200 hover:text-rose-600"
      )}
    >
      <Heart className={cn("h-4 w-4", isFavorited && "fill-current")} aria-hidden />
    </button>
  );
}
