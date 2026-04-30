import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/get-user";
import { getMyUserProfile } from "@/lib/profile/get-user-profile";
import {
  CAREER_STATUS_LABELS,
  GENDER_LABELS,
  SALARY_BAND_LABELS,
} from "@/lib/profile/schemas";

export const metadata = {
  title: "マイページ",
};

export default async function MypagePage() {
  const [user, profile, attrs] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    getMyUserProfile(),
  ]);
  if (!user) return null;
  const createdAt = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("ja-JP")
    : "-";
  const nickname = profile?.nickname;
  const greetingName = nickname ?? user.email ?? "ゲスト";
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          マイページ
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{greetingName} さん、ようこそ。</p>
      </div>

      {!nickname && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 text-sm text-ink sm:p-6">
          ニックネームがまだ設定されていません。{" "}
          <Link
            href="/mypage/settings"
            className="font-medium text-brand hover:text-brand-700"
          >
            プロフィールを設定する
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
        <h2 className="text-base font-semibold text-ink">アカウント情報</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Field label="ニックネーム" value={nickname ?? undefined} />
          <Field label="メールアドレス" value={user.email ?? undefined} breakAll />
          <Field label="登録日" value={createdAt} />
          <Field
            label="メール認証"
            value={user.emailConfirmedAt ? "完了" : "未完了"}
          />
        </dl>
      </div>

      <div className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
        <h2 className="text-base font-semibold text-ink">プロフィール属性</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Field label="生まれ年" value={attrs?.birthYear ? `${attrs.birthYear}年` : undefined} />
          <Field
            label="性別"
            value={attrs?.gender ? GENDER_LABELS[attrs.gender] : undefined}
          />
          <Field label="現住所（都道府県）" value={attrs?.prefecture ?? undefined} />
          <Field
            label="キャリアステータス"
            value={
              attrs?.careerStatus ? CAREER_STATUS_LABELS[attrs.careerStatus] : undefined
            }
          />
          <Field
            label="現在の年収"
            value={attrs?.salaryBand ? SALARY_BAND_LABELS[attrs.salaryBand] : undefined}
          />
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

function Field({
  label,
  value,
  breakAll,
}: {
  label: string;
  value?: string;
  breakAll?: boolean;
}) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-ink ${breakAll ? "break-all" : ""}`}>
        {value ?? <span className="text-ink-subtle">（未設定）</span>}
      </dd>
    </div>
  );
}
