import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function MypageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?next=/mypage");
  return (
    <>
      <Header showSearch={false} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <aside className="space-y-2 text-sm">
            <p className="text-base font-semibold tracking-wider text-ink-muted">
              マイページ
            </p>
            <nav className="flex flex-col gap-1">
              <Link
                href="/mypage"
                className="rounded-md px-2 py-1.5 text-ink hover:bg-surface-muted"
              >
                プロフィール
              </Link>
              <Link
                href="/mypage/favorites"
                className="rounded-md px-2 py-1.5 text-ink hover:bg-surface-muted"
              >
                お気に入り
              </Link>
              <Link
                href="/mypage/settings"
                className="rounded-md px-2 py-1.5 text-ink hover:bg-surface-muted"
              >
                設定
              </Link>
              <form action={signOut} className="mt-2 border-t border-surface-border pt-2">
                <button
                  type="submit"
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-ink-muted hover:bg-surface-muted hover:text-ink"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  ログアウト
                </button>
              </form>
            </nav>
          </aside>
          <div>{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
