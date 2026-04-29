import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * メール認証 / パスワードリセット / メール変更等のメール経由フローの戻り先。
 * @supabase/ssr の PKCE フローでは {{ .ConfirmationURL }} が
 *   <SITE_URL>/auth/confirm?token_hash=...&type=...&next=...
 * の形で展開されるため、verifyOtp を呼んでセッションを確立する。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/mypage";

  if (token_hash && type) {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.redirect(
      new URL(
        `/auth/sign-in?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL("/auth/sign-in?error=invalid_confirmation", request.url)
  );
}
