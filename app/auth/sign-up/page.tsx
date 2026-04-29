import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Divider } from "@/components/auth/AuthFormFields";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getCurrentUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "会員登録",
  description:
    "メールアドレス、または Google アカウントで年収辞典のアカウントを作成します。",
};

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect("/mypage");
  return (
    <AuthFormShell
      title="会員登録"
      subtitle="無料・広告なし。30秒で完了します。"
      footer={
        <p>
          すでにアカウントをお持ちの方は{" "}
          <Link href="/auth/sign-in" className="text-brand hover:text-brand-700">
            ログイン
          </Link>
        </p>
      }
    >
      <GoogleSignInButton next="/mypage" label="Googleで会員登録" />
      <Divider label="または" />
      <SignUpForm />
      <p className="mt-6 text-sm text-ink-subtle">
        登録すると{" "}
        <Link
          href="/terms-of-service"
          className="text-brand hover:text-brand-700"
        >
          利用規約
        </Link>
        {" "}および{" "}
        <Link
          href="/privacy-policy"
          className="text-brand hover:text-brand-700"
        >
          プライバシーポリシー
        </Link>
        に同意したことになります。
      </p>
    </AuthFormShell>
  );
}
