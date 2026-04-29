import { DeleteAccountForm } from "@/components/auth/DeleteAccountForm";
import { UpdateDisplayNameForm } from "@/components/auth/UpdateDisplayNameForm";
import { UpdateEmailForm } from "@/components/auth/UpdateEmailForm";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "アカウント設定",
};

export default async function SettingsPage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  if (!user) return null;
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          アカウント設定
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          表示名・メールアドレス・パスワードの変更や、退会ができます。
        </p>
      </div>

      <SettingCard title="表示名">
        <UpdateDisplayNameForm defaultValue={profile?.displayName ?? ""} />
      </SettingCard>

      <SettingCard title="メールアドレス">
        <UpdateEmailForm defaultValue={user.email ?? ""} />
      </SettingCard>

      <SettingCard title="パスワード">
        <UpdatePasswordForm />
      </SettingCard>

      <SettingCard title="退会" danger>
        <DeleteAccountForm />
      </SettingCard>
    </section>
  );
}

function SettingCard({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-6 sm:p-8 ${
        danger ? "border-negative/30" : "border-surface-border"
      }`}
    >
      <h2
        className={`text-base font-semibold ${
          danger ? "text-negative-600" : "text-ink"
        }`}
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}
