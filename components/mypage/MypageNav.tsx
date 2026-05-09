"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  KeyRound,
  LogOut,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const TRANSITION_MS = 200;

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ReactNode;
}> = [
  { href: "/mypage", label: "プロフィール", icon: <User className="h-4 w-4" /> },
  {
    href: "/mypage/favorites",
    label: "お気に入り",
    icon: <Heart className="h-4 w-4" />,
  },
  {
    href: "/mypage/settings",
    label: "メール・パスワード設定",
    icon: <KeyRound className="h-4 w-4" />,
  },
  {
    href: "/mypage/notifications",
    label: "通知・広告配信の設定",
    icon: <Settings className="h-4 w-4" />,
  },
];

/**
 * マイページのナビゲーション。
 *
 *  - lg+ では従来どおり左サイドバーとして常時表示
 *  - lg 未満では「サイドドロワー」として右からスライドイン
 *    開閉トリガーは Header 右上のプロフィールアバター（/mypage/* に居る時）。
 *    アバターから window に "mypage-menu-toggle" を dispatch する。
 *    ルート遷移 / Esc / オーバーレイクリック / 閉じるボタンで close。
 */
export function MypageNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();

  // ドロワー開閉。mounted は DOM 上に存在するか、shown は開閉アニメーション用
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  // window のカスタムイベントをトリガーに開閉
  useEffect(() => {
    const onToggle = () => {
      if (mounted) closeDrawer();
      else openDrawer();
    };
    window.addEventListener("mypage-menu-toggle", onToggle);
    return () => window.removeEventListener("mypage-menu-toggle", onToggle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ルート遷移したら自動で閉じる
  useEffect(() => {
    if (mounted) closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Esc で閉じる + body スクロール固定
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // mounted 直後に shown=true にして、CSS transition で右から滑り込ませる
  useEffect(() => {
    if (!mounted) return;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [mounted]);

  function openDrawer() {
    setMounted(true);
  }
  function closeDrawer() {
    setShown(false);
    window.setTimeout(() => setMounted(false), TRANSITION_MS);
  }

  return (
    <>
      {/* ===== lg+ 常時サイドバー ===== */}
      <aside className="hidden space-y-2 text-sm lg:block">
        <p className="text-base font-semibold tracking-wider text-ink-muted">
          マイページ
        </p>
        <NavList showAdmin={showAdmin} pathname={pathname} />
      </aside>

      {/* ===== <lg ドロワー ===== */}
      {mounted && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="マイページメニュー"
        >
          <div
            className={cn(
              "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out",
              shown ? "opacity-100" : "opacity-0"
            )}
            onClick={closeDrawer}
            aria-hidden
          />
          <div
            className={cn(
              "absolute right-0 top-0 flex h-full w-[85%] max-w-xs flex-col bg-white shadow-xl transition-transform duration-200 ease-out",
              shown ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-4 py-3">
              <span className="text-sm font-semibold text-ink">
                マイページメニュー
              </span>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="閉じる"
                className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavList
                showAdmin={showAdmin}
                pathname={pathname}
                withIcons
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavList({
  showAdmin,
  pathname,
  withIcons,
}: {
  showAdmin: boolean;
  pathname: string | null;
  withIcons?: boolean;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((it) => {
        const active =
          pathname === it.href ||
          (it.href !== "/mypage" && pathname?.startsWith(it.href + "/"));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-ink hover:bg-surface-muted",
              active && "bg-surface-muted font-semibold"
            )}
          >
            {withIcons && (
              <span className="text-ink-subtle">{it.icon}</span>
            )}
            <span>{it.label}</span>
          </Link>
        );
      })}
      {showAdmin && (
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1.5 font-semibold text-brand-700 hover:bg-brand-100"
        >
          <Shield className="h-4 w-4" aria-hidden />
          管理画面
        </Link>
      )}
      <form
        action={signOut}
        className="mt-2 border-t border-surface-border pt-2"
      >
        <button
          type="submit"
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          ログアウト
        </button>
      </form>
    </nav>
  );
}
