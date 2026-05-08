"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MemberForceState = "unauth" | "incomplete" | "complete";

type Props = {
  /** ログイン後の戻り URL */
  returnTo: string;
  /**
   * テスト用：実際の auth 状態を無視して指定状態に強制する。
   *   - "unauth" → 未ログイン扱い（モザイク + 会員登録 CTA）
   *   - "incomplete" → ログイン済 / プロフィール未入力（モザイク + プロフィール CTA）
   *   - "complete" → ログイン済 / プロフィール完了（モザイク解除）
   * 未指定時は実際の auth + profile を判定。
   */
  forceState?: MemberForceState;
};

/**
 * 公開ページに置く UI なしのコントローラ。
 * `[data-member-only]` 要素を走査し、ユーザの auth + profile 状態（または forceState）に応じて
 *   - is-unlocked クラスを付与（モザイク解除）
 *   - .member-overlay の CTA カードを挿入（ロック時のみ）
 * を担当する。
 */
export function MemberOnlyController({ returnTo, forceState }: Props) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let lockReason: "unauth" | "incomplete_profile" | null = null;

      if (forceState === "unauth") {
        lockReason = "unauth";
      } else if (forceState === "incomplete") {
        lockReason = "incomplete_profile";
      } else if (forceState === "complete") {
        lockReason = null;
      } else {
        // auto：実際の auth + profile を判定
        const sb = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!session) {
          lockReason = "unauth";
        } else {
          const res = await fetch("/api/me/can-view-member", {
            credentials: "same-origin",
          });
          if (res.status === 403) {
            const body = (await res.json().catch(() => ({}))) as {
              reason?: "unauth" | "incomplete_profile";
            };
            lockReason = body.reason ?? "incomplete_profile";
          } else if (!res.ok) {
            lockReason = "incomplete_profile";
          }
        }
      }

      if (cancelled) return;
      const sections = document.querySelectorAll<HTMLElement>(
        "[data-member-only='true']"
      );

      sections.forEach((el) => {
        // forceState が変わった時の再描画に備えて、いったんリセット
        el.classList.remove("is-unlocked");
        el.querySelector(".member-overlay")?.remove();

        if (lockReason === null) {
          el.classList.add("is-unlocked");
          return;
        }
        const overlay = document.createElement("div");
        overlay.className = "member-overlay";
        const link =
          lockReason === "unauth"
            ? `/auth/sign-up?next=${encodeURIComponent(returnTo)}`
            : "/mypage";
        const btnLabel =
          lockReason === "unauth" ? "会員登録（無料）で見る" : "プロフィールを設定";
        const desc =
          lockReason === "unauth"
            ? "無料の会員登録 + プロフィール入力でこのセクションが解除されます。"
            : "マイページで必須項目を入力するとこのセクションが解除されます。";
        overlay.innerHTML = `
          <div class="member-overlay__card">
            <p class="member-overlay__title">メンバー限定コンテンツ</p>
            <p class="member-overlay__desc">${escapeHtml(desc)}</p>
            <a class="member-overlay__btn" href="${link}">${escapeHtml(btnLabel)}</a>
          </div>
        `;
        el.appendChild(overlay);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [returnTo, forceState]);

  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
