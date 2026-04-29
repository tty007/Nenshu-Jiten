import Link from "next/link";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "パスワードを忘れた場合",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell
      title="パスワード再設定"
      subtitle="登録済みメールアドレス宛にリセット用リンクを送ります。"
      footer={
        <p>
          ログインに戻る場合は{" "}
          <Link href="/auth/sign-in" className="text-brand hover:text-brand-700">
            こちら
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthFormShell>
  );
}
