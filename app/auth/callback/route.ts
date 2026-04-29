import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase の OAuth / Email confirmation の戻り先。
 * `?code=...` を受け取り、サーバー側でセッション交換 → next にリダイレクト。
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
  return NextResponse.redirect(`${origin}${next}`);
}
