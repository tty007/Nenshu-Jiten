"use client";

import Link from "next/link";
import { ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CAREER_STATUS_LABELS,
  GENDER_LABELS,
  SALARY_BAND_LABELS,
} from "@/lib/profile/schemas";
import { fetchAdminUserDetail } from "@/lib/admin/actions";
import type { AdminUserDetail } from "@/lib/admin/get-admin-users";
import { cn } from "@/lib/utils";

const TRANSITION_MS = 180;

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

type Props = {
  open: boolean;
  userId: string | null;
  onClose: () => void;
};

export function UserDetailDialog({ open, userId, onClose }: Props) {
  const [shown, setShown] = useState(false);
  const [mountedDom, setMountedDom] = useState(false);
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // SSR 中は document が無いので、クライアントマウント後にだけ Portal を有効化
  useEffect(() => {
    setMountedDom(true);
  }, []);

  // open=true / userId 変化で fetch
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetchAdminUserDetail(userId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setData(res.data);
        else setError(res.error);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // フェードイン制御
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setShown(false);
    window.setTimeout(() => {
      onClose();
      setData(null);
      setError(null);
    }, TRANSITION_MS);
  }

  if (!open || !mountedDom) return null;

  // Portal で document.body 直下にレンダリングする。これにより親要素の
  // backdrop-blur / transform / overflow 等で生成される containing block の
  // 影響を受けず、`fixed inset-0` が必ず viewport を覆う。
  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-detail-title"
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out",
          shown ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-200 ease-out",
          shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-border bg-white px-6 py-4 sm:px-8">
          <div className="min-w-0">
            <h2
              id="user-detail-title"
              className="text-base font-semibold text-ink"
            >
              ユーザー詳細
            </h2>
            {data?.email && (
              <p className="mt-0.5 break-all text-xs text-ink-muted">
                {data.email}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {userId && (
              <Link
                href={`/admin/users/${userId}`}
                className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-100 hover:text-brand-700"
              >
                単独ページで開く
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label="閉じる"
              className="-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              読み込み中…
            </div>
          )}
          {error && !loading && (
            <p className="rounded-md border border-negative/30 bg-negative-50/40 px-4 py-3 text-sm text-negative-600">
              {error}
            </p>
          )}
          {data && !loading && <UserDetailContent data={data} />}
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}

function UserDetailContent({ data }: { data: AdminUserDetail }) {
  const profileRows: { label: string; value: string }[] = data.profile
    ? [
        { label: "ニックネーム", value: data.profile.nickname ?? "-" },
        {
          label: "生まれ年",
          value:
            data.profile.birthYear !== null
              ? `${data.profile.birthYear}年`
              : "-",
        },
        {
          label: "性別",
          value: data.profile.gender
            ? GENDER_LABELS[data.profile.gender as keyof typeof GENDER_LABELS] ??
              data.profile.gender
            : "-",
        },
        { label: "都道府県", value: data.profile.prefecture ?? "-" },
        {
          label: "キャリアステータス",
          value: data.profile.careerStatus
            ? CAREER_STATUS_LABELS[
                data.profile
                  .careerStatus as keyof typeof CAREER_STATUS_LABELS
              ] ?? data.profile.careerStatus
            : "-",
        },
        {
          label: "年収レンジ",
          value: data.profile.salaryBand
            ? SALARY_BAND_LABELS[
                data.profile.salaryBand as keyof typeof SALARY_BAND_LABELS
              ] ?? data.profile.salaryBand
            : "-",
        },
      ]
    : [];

  return (
    <div className="space-y-6 text-sm">
      {/* AUTH */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          認証情報
        </h3>
        <dl className="grid gap-3 rounded-xl border border-surface-border bg-white p-4 sm:grid-cols-2">
          <Row label="user_id">
            <span className="break-all font-numeric text-xs">{data.id}</span>
          </Row>
          <Row label="provider">{data.provider ?? "-"}</Row>
          <Row label="登録日時">{fmtDateTime(data.createdAt)}</Row>
          <Row label="メール認証">{fmtDateTime(data.emailConfirmedAt)}</Row>
          <Row label="最終ログイン">{fmtDateTime(data.lastSignInAt)}</Row>
        </dl>
      </section>

      {/* PROFILE */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          プロフィール (user_profiles)
        </h3>
        {data.profile ? (
          <dl className="grid gap-3 rounded-xl border border-surface-border bg-white p-4 sm:grid-cols-2">
            {profileRows.map((r) => (
              <Row key={r.label} label={r.label}>
                {r.value}
              </Row>
            ))}
            <Row label="プロフィール作成日">
              {fmtDateTime(data.profile.createdAt)}
            </Row>
          </dl>
        ) : (
          <p className="rounded-xl border border-dashed border-surface-border bg-white p-4 text-ink-muted">
            プロフィール未作成
          </p>
        )}
      </section>

      {/* FAVORITES */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          お気に入り企業 ({data.favorites.length})
        </h3>
        {data.favorites.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border bg-white p-4 text-ink-muted">
            登録なし
          </p>
        ) : (
          <ul className="max-h-56 divide-y divide-surface-border overflow-y-auto rounded-xl border border-surface-border bg-white pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-border">
            {data.favorites.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <Link
                  href={`/companies/${f.edinetCode}`}
                  className="min-w-0 truncate font-medium text-ink hover:text-brand-700"
                >
                  {f.name}
                </Link>
                <span className="shrink-0 font-numeric text-xs tabular-nums text-ink-muted">
                  {fmtDateTime(f.addedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
