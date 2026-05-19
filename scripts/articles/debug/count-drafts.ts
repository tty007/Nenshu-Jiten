import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
(async () => {
  const r = await sb.from("articles").select("id", { count: "exact", head: true }).eq("status", "draft");
  console.log("draft total:", r.count, "error:", r.error);
  const r2 = await sb.from("articles").select("id", { count: "exact", head: true }).neq("status", "draft");
  console.log("non-draft total:", r2.count);
})();
