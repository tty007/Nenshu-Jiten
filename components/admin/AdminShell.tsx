"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Building2,
  ChevronsRight,
  FileText,
  FolderTree,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-sidebar-collapsed";

// =====================================================================
// Context: 子コンポーネントから collapsed 状態をトグルできるようにする
// =====================================================================

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

/** ArticleEditor などから「サイドバーを閉じる/開く」ボタンを設置する用 */
export function useAdminSidebar(): SidebarContextValue | null {
  return useContext(SidebarContext);
}

// =====================================================================
// Nav 定義
// =====================================================================

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "ダッシュボード", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/admin/users", label: "ユーザー", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/companies", label: "企業リスト", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/articles", label: "記事一覧", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/articles/agent", label: "記事制作エージェント", icon: <Bot className="h-4 w-4" /> },
  { href: "/admin/articles/authors", label: "著者管理", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/articles/categories", label: "カテゴリ管理", icon: <FolderTree className="h-4 w-4" /> },
];

// =====================================================================
// AdminShell
// =====================================================================

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsedState(true);
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* noop */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-14 lg:px-10">
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
          <Shield className="h-3.5 w-3.5" aria-hidden />
          管理者権限で表示中
        </div>

        <div
          className={cn(
            "grid gap-0 transition-[grid-template-columns,column-gap] duration-300 ease-out",
            collapsed
              ? "lg:grid-cols-[0px_1fr] lg:gap-x-0"
              : "lg:grid-cols-[220px_1fr] lg:gap-x-10"
          )}
        >
          {/* サイドバー：常時 DOM に残し、CSS で幅 0 にして滑らかに収納 */}
          <aside
            className={cn(
              "lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-hidden transition-opacity duration-300 ease-out",
              collapsed
                ? "pointer-events-none opacity-0"
                : "opacity-100 lg:overflow-y-auto"
            )}
            aria-hidden={collapsed}
          >
            {/* 内側を固定幅にしてアニメーション中の文字折返しを防ぐ */}
            <div className="w-[220px]">
              <Sidebar hydrated={hydrated} />
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </main>

      {/* 折りたたみ中だけ：左下に開くボタンを浮動表示（どのページからでも開ける）
          常時 render してフェード in/out。閉じている時のみインタラクト可能 */}
      <button
        type="button"
        onClick={toggle}
        aria-label="サイドバーを開く"
        title="サイドバーを開く"
        aria-hidden={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        className={cn(
          "fixed bottom-6 left-6 z-40 inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-2 text-xs font-medium text-ink shadow-lg transition-all duration-300 ease-out hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
          collapsed
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        )}
      >
        <ChevronsRight className="h-4 w-4" />
        サイドバー
      </button>
    </SidebarContext.Provider>
  );
}

// =====================================================================
// Sidebar 本体（展開時のみレンダー）
// =====================================================================

function Sidebar({
  hydrated,
}: {
  hydrated: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-2 text-sm">
      <p className="text-base font-semibold tracking-wider text-ink-muted">
        管理画面
      </p>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeNavHref(pathname, NAV_ITEMS) === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-surface-muted",
                isActive ? "bg-brand-50 text-brand-700" : "text-ink"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}

        <Link
          href="/mypage"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border-t border-surface-border px-2 pt-3 pb-1.5 text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          マイページに戻る
        </Link>
      </nav>

      {!hydrated && <span className="sr-only">loading</span>}
    </div>
  );
}

function isActiveLink(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * NAV_ITEMS から最長一致する href を返す。
 * 例: /admin/articles/authors にいる時、/admin/articles と
 * /admin/articles/authors の両方が startsWith に該当するので、
 * より長い後者のみをアクティブ扱いにする。
 */
function activeNavHref(pathname: string | null, items: NavItem[]): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const it of items) {
    if (isActiveLink(pathname, it.href)) {
      if (!best || it.href.length > best.length) best = it.href;
    }
  }
  return best;
}
