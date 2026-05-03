"use client";

import Link from "next/link";
import { Briefcase, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { type PositionSalaryEstimateResult } from "@/lib/data/position-salary";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PositionSalaryEstimateSection } from "@/components/PositionSalaryEstimate";
import { cn } from "@/lib/utils";

// ロック表示用のダミー値。ぼかし越しに数値らしく見せるためだけのもので、
// 会社の実数とは無関係。順序は 非役職者 → 係長級 → 課長級 → 部長級。
const LOCKED_PLACEHOLDER_CARDS = [
  {
    role: "非役職者",
    nationalAge: 41.8,
    dummySalaryLabel: "550万円",
    dummyDiffLabel: "-31.0%",
    dummyStepUpPct: 31,
  },
  {
    role: "係長級",
    nationalAge: 45.4,
    dummySalaryLabel: "720万円",
    dummyDiffLabel: "-10.0%",
    dummyStepUpPct: 25,
  },
  {
    role: "課長級",
    nationalAge: 49.5,
    dummySalaryLabel: "900万円",
    dummyDiffLabel: "+13.0%",
    dummyStepUpPct: 28,
  },
  {
    role: "部長級",
    nationalAge: 53.1,
    dummySalaryLabel: "1150万円",
    dummyDiffLabel: "+44.0%",
    dummyStepUpPct: 0,
  },
] as const;

type LockReason = "unauth" | "incomplete_profile";
type State =
  | { status: "locked"; reason: LockReason }
  | { status: "unlocked"; result: PositionSalaryEstimateResult };

export function GatedPositionSalary({
  edinetCode,
  fiscalYear,
  returnTo,
}: {
  edinetCode: string;
  fiscalYear: number;
  returnTo: string;
}) {
  // SSR では未ログイン扱いを既定値にし、HTML に数値を一切載せない。
  // ハイドレーション後に Supabase でセッションと profile 完了を確認し、
  // 通れば API から数値を取得して unlocked 状態に上書きする。
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
        `/api/companies/${encodeURIComponent(edinetCode)}/position-estimate`,
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
      const result = (await res.json()) as PositionSalaryEstimateResult;
      if (!cancelled) setState({ status: "unlocked", result });
    })();
    return () => {
      cancelled = true;
    };
  }, [edinetCode]);

  if (state.status === "unlocked") {
    return (
      <PositionSalaryEstimateSection
        result={state.result}
        fiscalYear={fiscalYear}
      />
    );
  }

  return (
    <LockedSection lockReason={state.reason} returnTo={returnTo} />
  );
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
            役職別の推定年収
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            国の役職別賃金統計と、この会社の平均年収から逆算した推計値（昇進ステップ順）
          </p>
        </div>
        <Briefcase className="h-5 w-5 text-ink-muted" aria-hidden />
      </div>

      <div className="relative mt-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-2">
          {LOCKED_PLACEHOLDER_CARDS.map((e, i, arr) => {
            const isTop = i === arr.length - 1;
            const next = arr[i + 1];
            return (
              <Fragment key={e.role}>
                <div
                  className={cn(
                    "flex-1 rounded-xl border border-surface-border bg-surface-muted/40 p-4 transition",
                    isTop && "border-brand-100 bg-brand-50/40"
                  )}
                >
                  <span className="inline-flex items-center rounded-full bg-brand-600 px-3 py-1 text-sm font-bold text-white">
                    {e.role}
                  </span>
                  <p className="mt-2 pl-1 text-sm text-ink-subtle">
                    国 平均{e.nationalAge.toFixed(1)}歳
                  </p>
                  <p
                    aria-hidden
                    className="mt-3 select-none font-numeric text-2xl font-bold tabular-nums text-ink blur-md"
                  >
                    {e.dummySalaryLabel}
                  </p>
                  <span
                    aria-hidden
                    className="mt-2 inline-flex select-none items-center gap-0.5 rounded-md bg-surface-muted px-1.5 py-0.5 text-sm font-semibold text-ink-muted blur-md"
                  >
                    平均比 {e.dummyDiffLabel}
                  </span>
                </div>
                {next && (
                  <div
                    aria-hidden
                    className="flex shrink-0 items-center justify-center gap-1 lg:flex-col lg:gap-0"
                  >
                    <ChevronRight className="hidden h-5 w-5 text-brand-400 lg:block" />
                    <ChevronDown className="h-5 w-5 text-brand-400 lg:hidden" />
                    <span className="select-none font-numeric text-sm font-semibold tabular-nums text-brand-600 blur-md">
                      +{e.dummyStepUpPct}%
                    </span>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="pointer-events-auto">
            <UnlockCta lockReason={lockReason} returnTo={returnTo} />
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-ink-muted">
        国の役職別賃金（部長・課長・係長・非役職者）と、この会社の平均年収から逆算した推計値です。会員登録とプロフィール入力後にご覧いただけます。
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
        役職別年収情報は会員限定です
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
              href="/mypage/settings"
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
