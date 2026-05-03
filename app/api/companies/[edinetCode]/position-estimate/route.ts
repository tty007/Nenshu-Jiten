import { NextResponse, type NextRequest } from "next/server";
import { getCompanyByEdinetCode } from "@/lib/data/companies";
import { estimatePositionSalaries } from "@/lib/data/position-salary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  { params }: { params: Promise<{ edinetCode: string }> }
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

  const { edinetCode } = await params;
  const company = await getCompanyByEdinetCode(edinetCode);
  if (!company || !company.latest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = estimatePositionSalaries(
    company.latest.averageAge,
    company.latest.averageAnnualSalary
  );
  if (!result) {
    return NextResponse.json({ error: "no_estimate" }, { status: 404 });
  }
  return NextResponse.json(result);
}
