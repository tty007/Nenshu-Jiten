"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LockReason = "unauth" | "incomplete_profile";
type State =
  | { status: "loading" }
  | { status: "locked"; reason: LockReason }
  | { status: "unlocked"; html: string };

type Props = {
  articleId: string;
  /** ログインフロー後に戻る URL */
  returnTo: string;
  /** ゲート対象セクションの最初の見出し文（プレビュー用に表示） */
  previewHeading?: string;
};

export function GatedArticleRest({
  articleId,
  returnTo,
  previewHeading,
}: Props) {
  // SSR 時はロック状態（数値は HTML に出さない）
  const [state, setState] = useState<State>({ status: "loading" });

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
        `/api/articles/${encodeURIComponent(articleId)}/gated`,
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
      const data = (await res.json()) as { html: string };
      if (!cancelled) setState({ status: "unlocked", html: data.html ?? "" });
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (state.status === "unlocked") {
    return (
      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
    );
  }

  return (
    <LockedSection
      lockReason={state.status === "locked" ? state.reason : "unauth"}
      returnTo={returnTo}
      previewHeading={previewHeading}
    />
  );
}

function LockedSection({
  lockReason,
  returnTo,
  previewHeading,
}: {
  lockReason: LockReason;
  returnTo: string;
  previewHeading?: string;
}) {
  return (
    <section className="gated-rest">
      <div className="gated-rest__preview" aria-hidden>
        <div className="gated-rest__preview-h2">
          {previewHeading ?? "年代別の推定年収"}
        </div>
        <div className="gated-rest__preview-table">
          <div className="gated-rest__bar gated-rest__bar--head" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="gated-rest__bar" />
          ))}
        </div>
        <div className="gated-rest__preview-text">
          <div className="gated-rest__line" />
          <div className="gated-rest__line gated-rest__line--short" />
          <div className="gated-rest__line" />
          <div className="gated-rest__line gated-rest__line--medium" />
        </div>
      </div>

      <div className="gated-rest__overlay">
        <div className="gated-rest__cta">
          <div className="gated-rest__icon">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="gated-rest__title">
            ここからは会員限定コンテンツです
          </h3>
          <p className="gated-rest__desc">
            年代別の推定年収・役職別の推定年収・初任給・賞与・手取り推計・生涯年収・FAQ などを公開しています。
            <br />
            無料の会員登録とプロフィール入力で全文を読めます。
          </p>
          {lockReason === "unauth" ? (
            <div className="gated-rest__buttons">
              <Link
                href={`/auth/sign-in?next=${encodeURIComponent(returnTo)}`}
                className="gated-rest__btn-primary"
              >
                ログイン
              </Link>
              <Link
                href={`/auth/sign-up?next=${encodeURIComponent(returnTo)}`}
                className="gated-rest__btn-secondary"
              >
                会員登録（無料）
              </Link>
            </div>
          ) : (
            <div className="gated-rest__buttons">
              <Link href="/mypage" className="gated-rest__btn-primary">
                プロフィールを設定する
              </Link>
            </div>
          )}
        </div>
      </div>

      <GatedRestStyles />
    </section>
  );
}

function GatedRestStyles() {
  return (
    <style>{`
      .gated-rest {
        position: relative;
        margin: 1.5rem 0;
        min-height: 540px;
        overflow: hidden;
        border-top: 1px solid #e5e7eb;
      }
      /* ぼかしダミーコンテンツ */
      .gated-rest__preview {
        padding: 2rem 1rem 4rem;
        filter: blur(6px);
        opacity: 0.55;
        pointer-events: none;
        user-select: none;
      }
      .gated-rest__preview-h2 {
        font-size: 1.5rem;
        font-weight: 800;
        color: #1e40af;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 1.25rem;
      }
      .gated-rest__preview-table {
        display: grid;
        gap: 0.4rem;
        margin-bottom: 1.5rem;
      }
      .gated-rest__bar {
        height: 28px;
        background: #f1f5f9;
        border-radius: 4px;
      }
      .gated-rest__bar--head {
        background: #dbeafe;
      }
      .gated-rest__preview-text {
        display: grid;
        gap: 0.5rem;
      }
      .gated-rest__line {
        height: 12px;
        border-radius: 4px;
        background: #e2e8f0;
      }
      .gated-rest__line--short { width: 65%; }
      .gated-rest__line--medium { width: 85%; }

      /* CTA オーバーレイ */
      .gated-rest__overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.92) 35%, rgba(255,255,255,0.92) 100%);
      }
      .gated-rest__cta {
        max-width: 480px;
        width: 100%;
        padding: 1.6rem 1.5rem;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0;
        text-align: center;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        position: relative;
      }
      .gated-rest__cta::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: linear-gradient(180deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
      }
      .gated-rest__icon {
        margin: 0 auto;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 9999px;
        background: linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%);
        color: #1d4ed8;
      }
      .gated-rest__title {
        margin: 0.85rem 0 0.5rem;
        font-size: 1.05rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.005em;
      }
      .gated-rest__desc {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.85;
        color: #475569;
      }
      .gated-rest__buttons {
        margin-top: 1.1rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        justify-content: center;
      }
      .gated-rest__btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.2rem;
        font-size: 0.88rem;
        font-weight: 700;
        color: #ffffff;
        background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
        border-radius: 6px;
        text-decoration: none;
        transition: opacity 0.15s;
      }
      .gated-rest__btn-primary:hover { opacity: 0.92; }
      .gated-rest__btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.2rem;
        font-size: 0.88rem;
        font-weight: 600;
        color: #1e3a8a;
        background: #ffffff;
        border: 1px solid #c7d2fe;
        border-radius: 6px;
        text-decoration: none;
        transition: background 0.15s;
      }
      .gated-rest__btn-secondary:hover { background: #eff6ff; }
    `}</style>
  );
}
