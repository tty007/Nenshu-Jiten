import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  // 適当な 3 本を抽出して同業他社セクションをダンプ
  const sampleNames = ["クミアイ化学", "セルソース", "くら寿司"];
  for (const name of sampleNames) {
    const { data: c } = await sb.from("companies").select("id, name").ilike("name", `%${name}%`).limit(1).maybeSingle();
    if (!c) { console.log(`-- ${name}: not found`); continue; }
    const { data: acs } = await sb
      .from("article_companies")
      .select("article_id")
      .eq("company_id", (c as any).id);
    if (!acs || acs.length === 0) { console.log(`-- ${name}: no article`); continue; }
    const aIds = acs.map((a: any) => a.article_id);
    const { data: arts } = await sb.from("articles").select("id, title, body_html").in("id", aIds).eq("status", "draft");
    const a = (arts ?? [])[0] as any;
    if (!a) { console.log(`-- ${name}: no draft article`); continue; }
    const html = a.body_html as string;
    // 「同業他社との比較」セクションを抽出
    const startTag = "<h2>同業他社との比較</h2>";
    const idx = html.indexOf(startTag);
    if (idx < 0) { console.log(`-- ${name}: section not found`); continue; }
    // 次の <h2> までを抜く
    const after = html.slice(idx + startTag.length);
    const nextH2 = after.indexOf("<h2");
    const section = nextH2 >= 0 ? after.slice(0, nextH2) : after;
    console.log(`\n========== ${a.title.slice(0, 60)} ==========`);
    console.log(section.slice(0, 3000));
    console.log("...(truncated)" + (section.length > 3000 ? ` len=${section.length}` : ""));
  }
})();
