import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { loadSalaryArticleContext } from "../../lib/admin/articles/salary-template/data";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  // セルソース等の draft article を pick
  const names = ["セルソース", "クミアイ化学", "くら寿司", "学情", "ＦＵＮＤＩＮＮＯ"];
  for (const name of names) {
    const { data: c } = await sb.from("companies").select("id, name").ilike("name", `%${name}%`).limit(1).maybeSingle();
    if (!c) continue;
    const { data: acs } = await sb.from("article_companies").select("article_id").eq("company_id", (c as any).id);
    const ids = (acs ?? []).map((a: any) => a.article_id);
    const { data: arts } = await sb.from("articles").select("id, title").in("id", ids).eq("status", "draft");
    const a = (arts ?? [])[0] as any;
    if (!a) continue;
    const ctxRes = await loadSalaryArticleContext(a.id);
    if (!ctxRes.ok) { console.log(`-- ${name}: load FAILED: ${ctxRes.error}`); continue; }
    const ctx = ctxRes.data;
    console.log(
      `${name.padEnd(15, " ")}  industry=${ctx.company.industry_code}  peers=${ctx.peers.length}  total_in_industry=${ctx.peer_meta.total_in_industry}  self_rank=${ctx.peer_meta.self_rank}`
    );
  }
})();
