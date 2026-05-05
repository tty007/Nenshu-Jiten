import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminUserDetail } from "@/lib/admin/get-admin-users";
import {
  CAREER_STATUS_LABELS,
  GENDER_LABELS,
  SALARY_BAND_LABELS,
} from "@/lib/profile/schemas";
import { DeleteUserDialog } from "./_components/DeleteUserDialog";

export const metadata = { title: "ユーザー詳細" };

const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATETIME.format(d);
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getAdminUserDetail(userId);
  if (!user) notFound();

  const profileRows: { label: string; value: string }[] = user.profile
    ? [
        { label: "ニックネーム", value: user.profile.nickname ?? "-" },
        {
          label: "生まれ年",
          value:
            user.profile.birthYear !== null
              ? `${user.profile.birthYear}年`
              : "-",
        },
        {
          label: "性別",
          value: user.profile.gender
            ? GENDER_LABELS[user.profile.gender as keyof typeof GENDER_LABELS] ??
              user.profile.gender
            : "-",
        },
        { label: "都道府県", value: user.profile.prefecture ?? "-" },
        {
          label: "キャリアステータス",
          value: user.profile.careerStatus
            ? CAREER_STATUS_LABELS[
                user.profile.careerStatus as keyof typeof CAREER_STATUS_LABELS
              ] ?? user.profile.careerStatus
            : "-",
        },
        {
          label: "年収レンジ",
          value: user.profile.salaryBand
            ? SALARY_BAND_LABELS[
                user.profile.salaryBand as keyof typeof SALARY_BAND_LABELS
              ] ?? user.profile.salaryBand
            : "-",
        },
      ]
    : [];

  return (
    <section className="space-y-8">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          ユーザー一覧に戻る
        </Link>
        <h1 className="mt-2 break-all text-2xl font-bold tracking-tight text-ink">
          {user.email ?? "(no email)"}
        </h1>
      </div>

      <Section title="認証情報">
        <dl className="grid gap-3 rounded-2xl border border-surface-border bg-white p-5 text-sm sm:grid-cols-2">
          <Row label="user_id">
            <span className="break-all font-numeric text-xs">{user.id}</span>
          </Row>
          <Row label="provider">{user.provider ?? "-"}</Row>
          <Row label="登録日時">{fmtDateTime(user.createdAt)}</Row>
          <Row label="メール認証">{fmtDateTime(user.emailConfirmedAt)}</Row>
          <Row label="最終ログイン">{fmtDateTime(user.lastSignInAt)}</Row>
        </dl>
      </Section>

      <Section title="プロフィール (user_profiles)">
        {user.profile ? (
          <dl className="grid gap-3 rounded-2xl border border-surface-border bg-white p-5 text-sm sm:grid-cols-2">
            {profileRows.map((r) => (
              <Row key={r.label} label={r.label}>
                {r.value}
              </Row>
            ))}
            <Row label="プロフィール作成日">
              {fmtDateTime(user.profile.createdAt)}
            </Row>
          </dl>
        ) : (
          <p className="rounded-2xl border border-dashed border-surface-border bg-white p-5 text-sm text-ink-muted">
            プロフィール未作成
          </p>
        )}
      </Section>

      <Section title={`お気に入り企業 (${user.favorites.length})`}>
        {user.favorites.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-surface-border bg-white p-5 text-sm text-ink-muted">
            登録なし
          </p>
        ) : (
          <ul className="divide-y divide-surface-border rounded-2xl border border-surface-border bg-white">
            {user.favorites.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <Link
                  href={`/companies/${f.edinetCode}`}
                  className="font-medium text-ink hover:text-brand-700"
                >
                  {f.name}
                </Link>
                <span className="font-numeric text-xs tabular-nums text-ink-muted">
                  {fmtDateTime(f.addedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="アクション">
        <div className="rounded-2xl border border-negative/30 bg-negative-50/30 p-5">
          <p className="text-sm text-ink">
            このユーザーを完全に削除します。プロフィール・お気に入り含めて取り戻せません。
          </p>
          <div className="mt-3">
            {user.email ? (
              <DeleteUserDialog userId={user.id} email={user.email} />
            ) : (
              <p className="text-sm text-ink-muted">
                email が未設定のため、UI からの削除はできません。
              </p>
            )}
          </div>
        </div>
      </Section>
    </section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-ink sm:text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}
