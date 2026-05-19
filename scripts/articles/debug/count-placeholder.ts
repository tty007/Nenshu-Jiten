import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  const { data: arts } = await sb
    .from("articles")
    .select("id, title, body_html")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(500);
  const ts = (arts ?? []).filter((a: any) => (a.body_html ?? "").length > 1000);
  const placeholder = "同業界の比較データを準備中です";
  const hits = ts.filter((a: any) => (a.body_html as string).includes(placeholder));
  console.log(`Drafts total: ${ts.length}`);
  console.log(`With placeholder: ${hits.length}`);
  for (const h of hits) {
    console.log(`  ${h.id}  ${(h.title as string).slice(0, 60)}`);
  }
})();
