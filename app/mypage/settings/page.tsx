import { DeleteAccountForm } from "@/components/auth/DeleteAccountForm";
import { UpdateEmailForm } from "@/components/auth/UpdateEmailForm";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { UserProfileForm } from "@/components/profile/UserProfileForm";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getMyUserProfile } from "@/lib/profile/get-user-profile";

export const metadata = {
  title: "アカウント設定",
};

export default async function SettingsPage() {
  const [user, userProfile] = await Promise.all([
    getCurrentUser(),
    getMyUserProfile(),
  ]);
  if (!user) return null;
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          アカウント設定
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          プロフィール・メールアドレス・パスワードの変更や、退会ができます。
        </p>
      </div>

      <SettingCard
        title="プロフィール"
        description="ニックネームと属性情報。すべて任意です。"
      >
        <UserProfileForm initial={userProfile} />
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
  description,
  danger,
  children,
}: {
  title: string;
  description?: string;
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
      {description && (
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}
