"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { acknowledgeCurrentPolicy } from "@/lib/profile/acknowledge-actions";

/**
 * 改定後のプライバシーポリシー / 利用規約をログイン中ユーザに再確認させるモーダル。
 *
 * - 表示条件はサーバ側で判定し、`shouldShow` で渡される
 * - /privacy-policy, /terms-of-service, /external-transmission ページでは自動的に
 *   非表示（読まないと同意できないため、表示が邪魔にならないようにする）
 * - ボタンは「同意して続ける」のみ。ポリシー全文へは別タブのリンクを併設
 * - body のスクロールはロックしない（背後コンテンツは普通に閲覧できる）
 */
const SUPPRESSED_PATHS = new Set([
  "/privacy-policy",
  "/terms-of-service",
  "/external-transmission",
]);

export function PolicyReacknowledgementModal({
  shouldShow,
  policyVersion,
}: {
  shouldShow: boolean;
  policyVersion: string;
}) {
  const pathname = usePathname();
  const suppressedByPath = SUPPRESSED_PATHS.has(pathname ?? "");
  const [isPending, startTransition] = useTransition();
  const [closed, setClosed] = useState(false);

  // パスが変わったときに「閉じた」状態をリセットする（次の画面で再表示）
  useEffect(() => {
    setClosed(false);
  }, [pathname]);

  if (!shouldShow || suppressedByPath || closed) return null;

  function ack() {
    startTransition(async () => {
      await acknowledgeCurrentPolicy();
      setClosed(true);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ポリシー改定のお知らせ"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-4 pt-16 sm:items-center sm:p-6"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          ポリシー改定のお知らせ
        </p>
        <h2 className="mt-2 text-lg font-bold text-ink sm:text-xl">
          プライバシーポリシーと利用規約を更新しました
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          本サービスでは、広告配信に関する利用目的や個人関連情報の取扱いに関する条項を追加しました（{policyVersion}{" "}
          版）。引き続きご利用いただくため、改定内容をご確認のうえ「同意して続ける」を押してください。
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-muted">
          <li>広告・マーケティング目的の利用は同意した方のみが対象です</li>
          <li>マイページからいつでも同意を撤回できます</li>
        </ul>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-surface-border bg-white px-4 py-2 text-center text-sm font-medium text-ink hover:bg-surface-muted"
          >
            詳細を確認する
          </Link>
          <button
            type="button"
            onClick={ack}
            disabled={isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isPending ? "保存中…" : "同意して続ける"}
          </button>
        </div>
      </div>
    </div>
  );
}
