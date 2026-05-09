import {
  BarChart3,
  Bot,
  Building2,
  FileText,
  FolderTree,
  Users,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "ダッシュボード", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/admin/users", label: "ユーザー", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/companies", label: "企業リスト", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/articles", label: "記事一覧", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/articles/agent", label: "記事制作エージェント", icon: <Bot className="h-4 w-4" /> },
  { href: "/admin/articles/authors", label: "著者管理", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/articles/categories", label: "カテゴリ管理", icon: <FolderTree className="h-4 w-4" /> },
];

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
export function activeAdminNavHref(
  pathname: string | null,
  items: AdminNavItem[] = ADMIN_NAV_ITEMS
): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const it of items) {
    if (isActiveLink(pathname, it.href)) {
      if (!best || it.href.length > best.length) best = it.href;
    }
  }
  return best;
}
