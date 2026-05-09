import { redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MypageNav } from "@/components/mypage/MypageNav";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";

export const dynamic = "force-dynamic";

export default async function MypageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?next=/mypage");
  const showAdmin = await isCurrentUserAdmin();
  return (
    <>
      <Header showSearch={false} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <MypageNav showAdmin={showAdmin} />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
