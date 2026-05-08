import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminShell } from "@/components/admin/AdminShell";
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
      <AdminShell>{children}</AdminShell>
      <Footer />
    </>
  );
}
