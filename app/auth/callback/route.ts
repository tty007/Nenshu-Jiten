import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordInitialConsents } from "@/lib/profile/consent-actions";
import {
  clearPendingConsents,
  getPendingConsents,
} from "@/lib/profile/pending-consents";
import { recordPolicyAcknowledgement } from "@/lib/profile/acknowledge-actions";

/**
 * Supabase の OAuth / Email confirmation の戻り先。
 * `?code=...` を受け取り、サーバー側でセッション交換 → next にリダイレクト。
 *
 * サインアップ画面で `pending_consents` Cookie がセットされていた場合は、
 * セッション確立後にその同意状態を `user_consents` へ反映する。
 * （Cookie の TTL は 10 分。Sign-in 単独フローでは通常存在しない）
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/mypage";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=invalid_callback`);
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/sign-in?error=${encodeURIComponent(error.message)}`
    );
  }

  const { data: userRes } = await sb.auth.getUser();
  if (userRes.user?.id) {
    // サインアップ画面で取得済みの同意がある場合のみ反映する。
    // 既存ユーザでも Cookie が残っていれば「直近の意思表示」として upsert する
    // （履歴は user_consent_logs に積まれる）。
    const pending = await getPendingConsents();
    if (Object.keys(pending).length > 0) {
      await recordInitialConsents(userRes.user.id, pending, "signup_oauth");
      // pending 同意付きで来た = サインアップ画面を経由 = ポリシーを見ている。
      // 再同意モーダルを次画面で出さないよう、現行版確認済みとして記録する。
      await recordPolicyAcknowledgement(userRes.user.id);
    }
    await clearPendingConsents();
  }

  return NextResponse.redirect(`${origin}${next}`);
}
