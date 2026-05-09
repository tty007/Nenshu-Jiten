import { BadgeCheck } from "lucide-react";
import { EditProfileButton } from "@/components/profile/EditProfileButton";
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
    ? new Date(profile.createdAt).toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
      })
    : "-";
  const nickname = profile?.nickname;
  const greetingName = nickname ?? user.email ?? "ゲスト";
  const isProfileComplete = Boolean(
    attrs?.nickname &&
      attrs?.birthYear &&
      attrs?.gender &&
      attrs?.prefecture &&
      attrs?.careerStatus &&
      attrs?.salaryBand
  );
  return (
    <section className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            マイページ
          </h1>
          {isProfileComplete && (
            <span
              title="プロフィールがすべて入力されています"
              className="inline-flex items-center gap-1 rounded-full border border-positive/30 bg-positive-50 px-2.5 py-0.5 text-xs font-semibold text-positive-600"
            >
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              プロフィール入力完了
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">{greetingName} さん、ようこそ。</p>
      </div>

      {!nickname && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 text-sm text-ink sm:p-6">
          <p>ニックネームがまだ設定されていません。</p>
          <EditProfileButton initial={attrs} />
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
          <EditProfileButton initial={attrs} />
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
