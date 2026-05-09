"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  acceptAllCookies,
  rejectOptionalCookies,
  saveCookiePreferences,
} from "@/lib/consent/cookie-consent-actions";
import type { CookieConsentState } from "@/lib/consent/cookie-consent";

/**
 * Cookie 同意バナー（改正電気通信事業法 27条の12 対応）。
 *
 * 表示条件：
 *   - 初回訪問（state.decided === false）→ 自動表示
 *   - フッターの「Cookie設定を変更」リンクから window event "open-cookie-settings" を受け取った場合
 *
 * バナー外クリックでも閉じる（同意の意思表示なしで閉じた場合は Cookie 未設定の
 * ままなので、次回訪問時に再表示される）。
 */
const OPEN_EVENT = "open-cookie-settings";
const REOPEN_TRIGGER_ATTR = "data-cookie-settings-trigger";

export function CookieConsentBanner({ initial }: { initial: CookieConsentState }) {
  const [open, setOpen] = useState<boolean>(!initial.decided);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [analytics, setAnalytics] = useState<boolean>(initial.analytics);
  const [ads, setAds] = useState<boolean>(initial.ads);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = () => {
      setAnalytics(initial.analytics);
      setAds(initial.ads);
      setShowDetails(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, [initial.analytics, initial.ads]);

  // バナー外クリックで閉じる。再表示トリガ（フッターのボタン）は
  // 外側扱いから除外し、開いた直後に同じクリックで閉じてしまう事故を防ぐ。
  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (dialogRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest(`[${REOPEN_TRIGGER_ATTR}]`)
      ) {
        return;
      }
      setOpen(false);
      setShowDetails(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!open) return null;

  const submit = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      setOpen(false);
      setShowDetails(false);
    });

  const submitCustom = () =>
    startTransition(async () => {
      const fd = new FormData();
      if (analytics) fd.set("analytics", "on");
      if (ads) fd.set("ads", "on");
      await saveCookiePreferences(fd);
      setOpen(false);
      setShowDetails(false);
    });

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Cookieの利用に関する設定"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-border bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              Cookie の利用について
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              本サイトはサービス提供に必要な Cookie に加え、利用状況の解析および将来的な広告配信のために任意 Cookie を利用することがあります。詳細は{" "}
              <a
                href="/privacy-policy"
                className="text-brand hover:underline"
              >
                プライバシーポリシー
              </a>{" "}
              および{" "}
              <a
                href="/external-transmission"
                className="text-brand hover:underline"
              >
                外部送信に関する公表事項
              </a>{" "}
              をご確認ください。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => submit(rejectOptionalCookies)}
              disabled={isPending}
              className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-60"
            >
              必須のみ
            </button>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              disabled={isPending}
              className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-60"
              aria-expanded={showDetails}
            >
              カスタマイズ
            </button>
            <button
              type="button"
              onClick={() => submit(acceptAllCookies)}
              disabled={isPending}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              すべて許可
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 rounded-xl border border-surface-border bg-surface-soft/50 p-4">
            <ul className="divide-y divide-surface-border">
              <CategoryRow
                title="必須 Cookie"
                description="ログインセッション維持・CSRF 防止など、サービスの動作に不可欠です。これらは無効化できません。"
                checked
                locked
                onChange={() => {}}
              />
              <CategoryRow
                title="解析 Cookie"
                description="Vercel Analytics により、ページ閲覧数や利用パターンを匿名集計してサービス改善に役立てます。"
                checked={analytics}
                onChange={setAnalytics}
              />
              <CategoryRow
                title="広告 Cookie"
                description="将来導入予定の第三者広告ネットワーク（Google Ads 等）を通じて、関連性の高い広告を表示するために使われます。"
                checked={ads}
                onChange={setAds}
              />
            </ul>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={submitCustom}
                disabled={isPending}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                選択した内容で保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  locked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </div>
      <label className="mt-0.5 inline-flex shrink-0 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={locked}
          onChange={(e) => onChange(e.currentTarget.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`relative h-6 w-11 rounded-full transition-colors ${
            checked ? "bg-brand-600" : "bg-surface-border"
          } ${locked ? "opacity-60" : ""}`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </label>
    </li>
  );
}

/** フッターからバナーを再表示するためのトリガボタン */
export function ReopenCookieSettingsButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  // data 属性は CookieConsentBanner の外側クリック判定で「除外対象」として参照される
  const triggerProp = { [REOPEN_TRIGGER_ATTR]: "" } as Record<string, string>;
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      {...triggerProp}
    >
      {children}
    </button>
  );
}
