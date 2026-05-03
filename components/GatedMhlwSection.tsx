"use client";

import Link from "next/link";
import { Building2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import type { MhlwCompanyData } from "@/lib/data/mhlw-types";
import { MhlwSection } from "@/components/MhlwSection";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LockReason = "unauth" | "incomplete_profile";
type State =
  | { status: "locked"; reason: LockReason }
  | { status: "unlocked"; data: MhlwCompanyData };

const REQUIRED_FIELDS = [
  "nickname",
  "birth_year",
  "gender",
  "prefecture",
  "career_status",
  "salary_band",
] as const;

// プレースホルダー用のダミーメトリクス。会社の実数とは無関係。
const PLACEHOLDER_TILES = [
  { label: "男性育休取得率", value: "◯◯.◯%" },
  { label: "女性育休取得率", value: "◯◯.◯%" },
  { label: "有給休暇取得率", value: "◯◯.◯%" },
  { label: "管理職に占める女性比率", value: "◯◯.◯%" },
  { label: "係長相当に占める女性比率", value: "◯◯.◯%" },
  { label: "役員に占める女性比率", value: "◯◯.◯%" },
  { label: "平均残業時間", value: "◯◯.◯h" },
  { label: "男女賃金差（全体）", value: "◯◯.◯%" },
];

export function GatedMhlwSection({
  edinetCode,
  returnTo,
}: {
  edinetCode: string;
  returnTo: string;
}) {
  // SSR は未ログイン扱いで描画 → 数値は HTML に出さない
  const [state, setState] = useState<State>({
    status: "locked",
    reason: "unauth",
  });

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session) {
        if (!cancelled) setState({ status: "locked", reason: "unauth" });
        return;
      }
      const res = await fetch(
        `/api/companies/${encodeURIComponent(edinetCode)}/mhlw`,
        { credentials: "same-origin" }
      );
      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as {
          reason?: LockReason;
        };
        if (!cancelled) {
          setState({
            status: "locked",
            reason: body.reason ?? "incomplete_profile",
          });
        }
        return;
      }
      if (!res.ok) {
        if (!cancelled) {
          setState({ status: "locked", reason: "incomplete_profile" });
        }
        return;
      }
      const data = (await res.json()) as MhlwCompanyData;
      if (!cancelled) setState({ status: "unlocked", data });
    })();
    return () => {
      cancelled = true;
    };
  }, [edinetCode]);

  if (state.status === "unlocked") {
    return <MhlwSection data={state.data} />;
  }

  return <LockedSection lockReason={state.reason} returnTo={returnTo} />;
}

function LockedSection({
  lockReason,
  returnTo,
}: {
  lockReason: LockReason;
  returnTo: string;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
            女性活躍・両立支援の取り組み
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            厚生労働省「女性の活躍推進企業データベース」に企業自身が公表した内容
          </p>
        </div>
        <Building2 className="h-5 w-5 text-ink-muted" aria-hidden />
      </div>

      <div className="relative mt-6">
        <div
          className={cn(
            "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
            "pointer-events-none select-none blur-md"
          )}
          aria-hidden
        >
          {PLACEHOLDER_TILES.map((t) => (
            <div
              key={t.label}
              className="rounded-xl border border-surface-border bg-surface-muted/40 p-4"
            >
              <p className="text-xs text-ink-muted">{t.label}</p>
              <p className="mt-2 font-numeric text-2xl font-bold tabular-nums text-ink">
                {t.value}
              </p>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="pointer-events-auto">
            <UnlockCta lockReason={lockReason} returnTo={returnTo} />
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-ink-muted">
        男女賃金差・育休取得率・くるみん／えるぼし等の認定取得状況は、会員登録とプロフィール入力後にご覧いただけます。
      </p>
    </section>
  );
}

function UnlockCta({
  lockReason,
  returnTo,
}: {
  lockReason: LockReason;
  returnTo: string;
}) {
  return (
    <div className="max-w-md rounded-2xl border border-surface-border bg-white/95 p-5 text-center shadow-xl backdrop-blur-sm sm:p-6">
      <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Lock className="h-4 w-4" aria-hidden />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-ink sm:text-base">
        女性活躍・両立支援データは会員限定です
      </h3>
      {lockReason === "unauth" ? (
        <>
          <p className="mt-1.5 text-sm text-ink-muted">
            会員登録（無料）とプロフィール入力で見られます。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href={`/auth/sign-in?next=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              ログイン
            </Link>
            <Link
              href={`/auth/sign-up?next=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center rounded-md border border-surface-border bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              会員登録
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-ink-muted">
            マイページのプロフィールをすべて入力すると見られます。
          </p>
          <div className="mt-4">
            <Link
              href="/mypage"
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              プロフィールを設定する
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
