import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "マイページ",
};

export default async function MypagePage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  if (!user) return null;
  const createdAt = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("ja-JP")
    : "-";
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          マイページ
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {profile?.displayName ?? user.email ?? "ゲスト"} さん、ようこそ。
        </p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
        <h2 className="text-base font-semibold text-ink">プロフィール</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">表示名</dt>
            <dd className="mt-1 text-ink">
              {profile?.displayName ?? "（未設定）"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">メールアドレス</dt>
            <dd className="mt-1 break-all text-ink">{user.email ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">登録日</dt>
            <dd className="mt-1 text-ink">{createdAt}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">メール認証</dt>
            <dd className="mt-1 text-ink">
              {user.emailConfirmedAt ? "完了" : "未完了"}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/mypage/settings"
            className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            設定を変更する
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
