import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthFormShell } from "@/components/auth/AuthFormShell";

export const metadata = {
  title: "メールアドレスの確認",
};

export default function VerifyEmailPage() {
  return (
    <AuthFormShell
      title="確認メールを送信しました"
      footer={
        <p>
          ログインに戻る場合は{" "}
          <Link href="/auth/sign-in" className="text-brand hover:text-brand-700">
            こちら
          </Link>
        </p>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center text-sm text-ink">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Mail className="h-6 w-6" aria-hidden />
        </span>
        <p>
          ご登録のメールアドレス宛に、確認用のリンクを送信しました。
          <br />
          メール内のリンクを開くと登録が完了します。
        </p>
        <p className="text-sm text-ink-muted">
          数分待ってもメールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>
      </div>
    </AuthFormShell>
  );
}
