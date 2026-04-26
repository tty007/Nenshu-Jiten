import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";

export function Header({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white"
          >
            <span className="font-numeric text-sm font-bold tracking-tight">
              Y
            </span>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">
            年収辞典
          </span>
        </Link>
        {showSearch && (
          <div className="ml-auto hidden flex-1 sm:flex sm:max-w-md">
            <SearchBox size="sm" />
          </div>
        )}
        <nav className="ml-auto flex items-center gap-4 text-sm text-ink-muted sm:ml-0">
          <Link href="/industries" className="hover:text-ink">
            業界一覧
          </Link>
          <Link href="/data-source" className="hover:text-ink">
            データ出典
          </Link>
        </nav>
      </div>
    </header>
  );
}
