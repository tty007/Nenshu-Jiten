import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type SuggestItem = {
  edinetCode: string;
  name: string;
  securitiesCode: string | null;
  industryName: string | null;
};

const LIMIT = 8;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ items: [] });
  const safe = q.replace(/[%_,()]/g, "");
  if (!safe) return NextResponse.json({ items: [] });
  const sb = client();
  const { data, error } = await sb
    .from("companies")
    .select(
      "edinet_code, name, securities_code, industries (name)"
    )
    .or(
      [
        // 名前は部分一致、コード類は前方一致（コード内の数字部分にたまたま
        // 一致するノイズを排除する。例: "7777" → 証券コード 7777 だけ。
        // EDINET コード "E37777" 等は対象外）
        `name.ilike.%${safe}%`,
        `name_kana.ilike.%${safe}%`,
        `securities_code.ilike.${safe}%`,
        `edinet_code.ilike.${safe}%`,
      ].join(",")
    )
    .order("name")
    .limit(LIMIT);
  if (error) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }
  type Row = {
    edinet_code: string;
    name: string;
    securities_code: string | null;
    industries: { name: string | null } | { name: string | null }[] | null;
  };
  const items: SuggestItem[] = ((data as unknown as Row[]) ?? []).map((r) => {
    const ind = Array.isArray(r.industries) ? r.industries[0] : r.industries;
    return {
      edinetCode: r.edinet_code,
      name: r.name,
      securitiesCode: r.securities_code,
      industryName: ind?.name ?? null,
    };
  });
  return NextResponse.json({ items });
}
