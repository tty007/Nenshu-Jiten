import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { splitAtGatedSection, extractTocAndAddIds } from "@/lib/article-toc";

const REQUIRED_FIELDS = [
  "nickname",
  "birth_year",
  "gender",
  "prefecture",
  "career_status",
  "salary_band",
] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const aRes = await admin
    .from("articles")
    .select("id, body_html, status")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (aRes.error || !aRes.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { gated, hasGate } = splitAtGatedSection(aRes.data.body_html ?? "");
  if (!hasGate) {
    return NextResponse.json({ html: "" });
  }
  // 見出しに id を付け直して返す（公開ページ側の TOC アンカーと整合）
  const { htmlWithIds } = extractTocAndAddIds(gated);
  return NextResponse.json({ html: htmlWithIds });
}
