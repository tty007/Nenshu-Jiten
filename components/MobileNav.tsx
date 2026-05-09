"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Heart,
  KeyRound,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { SearchBox } from "@/components/SearchBox";
import {
  ADMIN_NAV_ITEMS,
  activeAdminNavHref,
} from "@/components/admin/admin-nav-items";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const TRANSITION_MS = 200;

export type MobileNavUser = {
  label: string;
  initial: string;
} | null;

export function MobileNav({
  user,
  showAdmin,
  showSearch,
}: {
  user: MobileNavUser;
  showAdmin: boolean;
  showSearch: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  // SSR 中は document が存在しないため、クライアント側にマウントされた後だけ
  // createPortal を呼ぶ。
  const [domReady, setDomReady] = useState(false);
  useEffect(() => {
    setDomReady(true);
  }, []);
  const pathname = usePathname();
  const isOnAdmin = pathname?.startsWith("/admin") ?? false;
  const adminActiveHref = activeAdminNavHref(pathname);

  // ルート遷移したら自動で閉じる
  useEffect(() => {
    if (mounted) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function open() {
    setMounted(true);
  }
  function close() {
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
      if (e.key === "Escape") close();
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

  // ドロワー本体。Header (backdrop-blur 付き) の中で fixed を張ると
  // 包含ブロックが Header 要素になり viewport まで広がらないので、
  // createPortal で document.body 直下に出して stacking context を抜ける。
  const drawer = mounted && (
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="メニュー"
    >
          <div
            className={cn(
              "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out",
              shown ? "opacity-100" : "opacity-0"
            )}
            onClick={close}
            aria-hidden
          />
          <div
            className={cn(
              "absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-white shadow-xl transition-transform duration-200 ease-out",
              shown ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-4 py-3">
              <span className="text-sm font-semibold text-ink-muted">メニュー</span>
              <button
                type="button"
                onClick={close}
                aria-label="閉じる"
                className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showSearch && (
                <div className="border-b border-surface-border px-4 py-4">
                  <SearchBox size="sm" />
                </div>
              )}

              {user && (
                <div className="border-b border-surface-border px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white"
                    >
                      {user.initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {user.label}
                      </p>
                      <Link
                        href="/mypage"
                        className="text-xs text-ink-muted hover:text-brand-700"
                      >
                        マイページを見る →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <nav className="px-2 py-3">
                {!isOnAdmin && (
                  <>
                    <NavGroupHeading>サイト内</NavGroupHeading>
                    <NavLink
                      href="/search?sort=salary"
                      icon={<BarChart3 className="h-4 w-4" />}
                      label="ランキング"
                    />
                    <NavLink
                      href="/industries"
                      icon={<Building2 className="h-4 w-4" />}
                      label="業界一覧"
                    />
                  </>
                )}

                {user ? (
                  <>
                    {isOnAdmin ? (
                      <>
                        <NavGroupHeading>管理画面</NavGroupHeading>
                        {ADMIN_NAV_ITEMS.map((item) => {
                          const active = adminActiveHref === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-muted",
                                active
                                  ? "bg-brand-50 font-semibold text-brand-700"
                                  : "text-ink"
                              )}
                            >
                              {item.icon}
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                        <Link
                          href="/mypage"
                          className="mt-2 flex items-center gap-2 rounded-md border-t border-surface-border px-3 pt-3 pb-2 text-sm text-ink-muted hover:text-ink"
                        >
                          <ArrowLeft className="h-4 w-4" aria-hidden />
                          マイページに戻る
                        </Link>
                      </>
                    ) : (
                      <>
                        <NavGroupHeading className="mt-4">マイページ</NavGroupHeading>
                        <NavLink
                          href="/mypage"
                          icon={<User className="h-4 w-4" />}
                          label="プロフィール"
                        />
                        <NavLink
                          href="/mypage/favorites"
                          icon={<Heart className="h-4 w-4" />}
                          label="お気に入り"
                        />
                        <NavLink
                          href="/mypage/settings"
                          icon={<KeyRound className="h-4 w-4" />}
                          label="メール・パスワード設定"
                        />
                        <NavLink
                          href="/mypage/notifications"
                          icon={<Settings className="h-4 w-4" />}
                          label="通知・広告配信の設定"
                        />
                        {showAdmin && (
                          <Link
                            href="/admin"
                            className="mt-2 inline-flex w-full items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            <Shield className="h-4 w-4" aria-hidden />
                            管理画面
                          </Link>
                        )}
                      </>
                    )}
                    <form action={signOut} className="mt-3 border-t border-surface-border pt-3">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
                      >
                        <LogOut className="h-4 w-4" aria-hidden />
                        ログアウト
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="mt-4 px-1">
                    <Link
                      href="/auth/sign-in"
                      className="inline-flex w-full items-center justify-center rounded-md bg-gradient-to-r from-blue-700 to-sky-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-800 hover:to-sky-500"
                    >
                      ログイン / 新規登録
                    </Link>
                  </div>
                )}
              </nav>
            </div>
          </div>
        </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="メニューを開く"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-surface-muted md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      {domReady && drawer && createPortal(drawer, document.body)}
    </>
  );
}

function NavGroupHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle",
        className
      )}
    >
      {children}
    </p>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-surface-muted"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
