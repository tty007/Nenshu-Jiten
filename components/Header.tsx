import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { UserMenu } from "@/components/auth/UserMenu";
import { ProfileAvatar } from "@/components/auth/ProfileAvatar";
import { MobileNav, type MobileNavUser } from "@/components/MobileNav";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/get-user";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";

export async function Header({ showSearch = true }: { showSearch?: boolean }) {
  const [user, profile, showAdmin] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    isCurrentUserAdmin(),
  ]);

  const navUser: MobileNavUser = user
    ? (() => {
        const label = profile?.nickname || user.email || "アカウント";
        const initial = (
          label.match(/[A-Za-z0-9ぁ-んァ-ヶ一-龯]/)?.[0] ?? "U"
        ).toUpperCase();
        return { label, initial };
      })()
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <span className="bg-gradient-to-r from-blue-700 to-sky-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
            年収辞典
          </span>
        </Link>

        {/* PC: 検索 + ナビ + UserMenu を横並び */}
        {showSearch && (
          <div className="ml-auto hidden flex-1 md:flex md:max-w-md">
            <SearchBox size="sm" />
          </div>
        )}
        <nav className="ml-auto hidden items-center gap-6 text-sm text-ink-muted md:flex">
          <Link href="/search?sort=salary" className="hover:text-ink">
            ランキング
          </Link>
          <Link href="/industries" className="hover:text-ink">
            業界一覧
          </Link>
          <UserMenu />
        </nav>

        {/* スマホ: 未ログインなら CTA、ログイン中はアバターのみ。常にハンバーガー。 */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          {!user && (
            <Link
              href="/auth/sign-in"
              className="inline-flex items-center rounded-md bg-gradient-to-r from-blue-700 to-sky-400 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-blue-800 hover:to-sky-500"
            >
              ログイン
            </Link>
          )}
          {user && navUser && (
            <ProfileAvatar
              initial={navUser.initial}
              label={navUser.label}
            />
          )}
          <MobileNav
            user={navUser}
            showAdmin={showAdmin}
            showSearch={showSearch}
          />
        </div>
      </div>
    </header>
  );
}
