import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REQUIRED_FIELDS = [
  "nickname",
  "birth_year",
  "gender",
  "prefecture",
  "career_status",
  "salary_band",
] as const;

/**
 * 会員限定コンテンツを閲覧できるかチェック。
 * 200 ok = 閲覧可。
 * 403 reason="unauth"          = 未ログイン
 * 403 reason="incomplete_profile" = プロフィール必須項目が未入力
 */
export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ reason: "unauth" }, { status: 403 });
  }
  const { data: profile } = await sb
    .from("user_profiles")
    .select(
      "nickname, birth_year, gender, prefecture, career_status, salary_band"
    )
    .eq("user_id", user.id)
    .maybeSingle<Record<(typeof REQUIRED_FIELDS)[number], unknown>>();
  const complete =
    !!profile && REQUIRED_FIELDS.every((f) => profile[f] !== null);
  if (!complete) {
    return NextResponse.json(
      { reason: "incomplete_profile" },
      { status: 403 }
    );
  }
  return NextResponse.json({ ok: true });
}
