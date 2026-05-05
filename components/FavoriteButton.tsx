"use client";

import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
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
    // 楽観更新は startTransition の外に置き、pending 切替と同じ urgent 優先度で
    // 反映させる（transition 内に置くと pending=true が先に来て isFavorited が
    // 旧値のまま描画される 1 フレームが発生し、ADD 時に "削除中…"・REMOVE 時に
    // "保存中…" がチラ見えする）。
    setIsFavorited(willAdd);
    const loadingId = toast.loading(
      willAdd ? "お気に入りに追加中…" : "お気に入りから削除中…"
    );
    startTransition(async () => {
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
  const heroLabel = pending
    ? isFavorited
      ? "保存中…"
      : "削除中…"
    : isFavorited
      ? "保存済み"
      : "お気に入り";

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={isFavorited}
        aria-busy={pending}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium backdrop-blur transition",
          "disabled:cursor-not-allowed",
          isFavorited
            ? "border-rose-200/80 bg-rose-50/95 text-rose-600 hover:bg-rose-100"
            : "border-white/30 bg-white/15 text-white hover:bg-white/25"
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Heart
            className={cn("h-4 w-4", isFavorited && "fill-current")}
            aria-hidden
          />
        )}
        {heroLabel}
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
      aria-busy={pending}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border transition",
        "disabled:cursor-not-allowed",
        isFavorited
          ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
          : "border-surface-border bg-white text-ink-muted hover:border-rose-200 hover:text-rose-600"
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Heart
          className={cn("h-4 w-4", isFavorited && "fill-current")}
          aria-hidden
        />
      )}
    </button>
  );
}
