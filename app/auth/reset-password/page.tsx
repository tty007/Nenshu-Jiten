import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "パスワードを設定",
};

export default function ResetPasswordPage() {
  return (
    <AuthFormShell
      title="新しいパスワードを設定"
      subtitle="リセット用メールから遷移されました。新しいパスワードを設定してください。"
    >
      <ResetPasswordForm />
    </AuthFormShell>
  );
}
