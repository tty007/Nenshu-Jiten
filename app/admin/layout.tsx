import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Shield, Users } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";

// /admin は cookies (ログイン状態) を必ず読むため動的レンダリング。
export const dynamic = "force-dynamic";

// S2: 管理画面は検索エンジンに index させない。
export const metadata: Metadata = {
  title: { default: "管理画面", template: "%s | 管理画面" },
  robots: { index: false, follow: false },
  // S3: Referrer-Policy は metadata 経由では設定不可なので
  //     <meta name="referrer"> でフォールバック対応する。
  referrer: "same-origin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?next=/admin");
  const allowed = await isCurrentUserAdmin();
  // S: 存在自体を隠すため 404
  if (!allowed) notFound();

  return (
    <>
      <Header showSearch={false} />
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-14 lg:px-10">
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
          <Shield className="h-3.5 w-3.5" aria-hidden />
          管理者権限で表示中
        </div>
        <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
          <aside className="space-y-2 text-sm">
            <p className="text-base font-semibold tracking-wider text-ink-muted">
              管理画面
            </p>
            <nav className="flex flex-col gap-1">
              <SideLink href="/admin" label="ダッシュボード" icon={<BarChart3 className="h-4 w-4" />} />
              <SideLink href="/admin/users" label="ユーザー" icon={<Users className="h-4 w-4" />} />
              <Link
                href="/mypage"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border-t border-surface-border px-2 pt-3 pb-1.5 text-ink-muted hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                マイページに戻る
              </Link>
            </nav>
          </aside>
          <div>{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function SideLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-ink hover:bg-surface-muted"
    >
      {icon}
      {label}
    </Link>
  );
}
