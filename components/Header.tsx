import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { UserMenu } from "@/components/auth/UserMenu";

export function Header({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <span className="bg-gradient-to-r from-blue-700 to-sky-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
            年収辞典
          </span>
        </Link>
        {showSearch && (
          <div className="ml-auto hidden flex-1 sm:flex sm:max-w-md">
            <SearchBox size="sm" />
          </div>
        )}
        <nav className="ml-auto flex items-center gap-6 text-sm text-ink-muted">
          <Link href="/search?sort=salary" className="hover:text-ink">
            ランキング
          </Link>
          <Link href="/industries" className="hover:text-ink">
            業界一覧
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
