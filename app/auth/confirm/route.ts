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
  const rawNext = searchParams.get("next");
  const safeNext = sanitizeNext(rawNext, request);

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=invalid_confirmation", request.url)
    );
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.verifyOtp({ type, token_hash });
  if (error) {
    console.warn("[auth/confirm] verifyOtp error:", error.message);
    return NextResponse.redirect(
      new URL(
        `/auth/sign-in?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}

/**
 * next パラメータを安全な同一オリジンの相対パスに正規化する。
 * /auth/* へのリダイレクトは無限ループや無意味な遷移を招くので /mypage に置き換え。
 */
function sanitizeNext(raw: string | null, request: NextRequest): string {
  if (!raw) return "/mypage";
  try {
    const u = new URL(raw, request.url);
    if (u.origin !== request.nextUrl.origin) return "/mypage";
    if (u.pathname.startsWith("/auth/")) return "/mypage";
    return u.pathname + u.search;
  } catch {
    return "/mypage";
  }
}
