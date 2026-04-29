import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Divider } from "@/components/auth/AuthFormFields";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { SignInForm } from "@/components/auth/SignInForm";
import { getCurrentUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "ログイン",
  description:
    "メールアドレスまたは Google アカウントで年収辞典にログインします。",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(params.next || "/mypage");
  const next = params.next;
  return (
    <AuthFormShell
      title="ログイン"
      footer={
        <p>
          アカウント未登録の方は{" "}
          <Link href="/auth/sign-up" className="text-brand hover:text-brand-700">
            会員登録
          </Link>
        </p>
      }
    >
      {params.error && (
        <p className="mb-4 rounded-md border border-negative/30 bg-negative-50 px-3 py-2 text-sm text-negative-600">
          {params.error}
        </p>
      )}
      <GoogleSignInButton next={next} label="Googleでログイン" />
      <Divider label="または" />
      <SignInForm next={next} />
    </AuthFormShell>
  );
}
