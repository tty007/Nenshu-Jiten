/**
 * 下書きを多めにサンプリングし、各記事から AI セクション
 * （§4.3 / §4.8 / §4.11 / §4.12）部分を抜き出してダンプする。
 *
 * 同時に、典型的な NG パターン（研修制度／海外展開／残業時間 等）の
 * 出現を機械的にスコアリングする。
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const NG_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "研修制度",   re: /研修制度|教育制度|研修体制|研修プログラム|教育プログラム|教育研修|社員研修/ },
  { name: "海外/グローバル", re: /海外展開|海外事業|海外サポート|海外駐在|海外赴任|グローバル展開|グローバル人材|グローバル化|国際的な視野|国際的なキャリア|国際展開/ },
  { name: "ジョブローテ", re: /ジョブローテーション|ジョブ・ローテーション|ローテーション制度/ },
  { name: "福利厚生(具体)", re: /育児休暇|育休制度|健康診断制度|住宅手当|家族手当|社員寮|保養所|食堂完備|退職金制度が充実|福利厚生が充実|手厚い福利/ },
  { name: "残業時間(具体)", re: /残業時間.{0,20}(時間|h)|月平均.{0,10}(時間|h).{0,10}残業|残業.{0,5}少なめ|残業.{0,5}多め/ },
  { name: "初任給(具体)", re: /初任給.{0,20}万円|初任給.{0,10}水準|初任給.{0,10}スタート|初任給は.{0,30}業界/ },
  { name: "賞与(具体)", re: /賞与.{0,20}(月分|ヶ月|か月)|ボーナス.{0,20}(月分|ヶ月|か月)/ },
  { name: "ダイバ施策推測", re: /多様性.{0,20}取り組み|女性の活躍を促進|女性活躍推進.{0,20}取り組み|D&I|ダイバーシティ.{0,15}推進/ },
  { name: "断定褒め言葉", re: /業界トップ|業界をリード|トップクラス|国内有数|圧倒的|高い競争力|優れた技術力|理想的な職場|魅力的な環境|安定した職場環境/ },
  { name: "業界平均上回る誤", re: /業界平均を上回る|業界平均より高い水準|業界の中でも高い水準/ },
];

async function main() {
  const { data, error } = await sb
    .from("articles")
    .select("id, title, body_html, updated_at")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  const rows = (data ?? []).filter((r) => (r.body_html ?? "").length > 5000);
  // 上位15件をサンプル
  const sample = rows.slice(0, 15);
  console.log(`Total drafts (>=5000chars): ${rows.length}`);
  console.log(`Sampling first ${sample.length}\n`);

  const counts: Record<string, number> = {};
  for (const p of NG_PATTERNS) counts[p.name] = 0;

  for (let i = 0; i < sample.length; i++) {
    const a = sample[i];
    const html = a.body_html as string;
    const hits: string[] = [];
    for (const p of NG_PATTERNS) {
      const m = html.match(p.re);
      if (m) {
        counts[p.name]++;
        hits.push(`${p.name}: "${m[0]}"`);
      }
    }
    console.log(`[${i + 1}/${sample.length}] ${a.id} ${a.title.slice(0, 48)}`);
    if (hits.length === 0) console.log("  (no NG patterns matched)");
    else hits.forEach((h) => console.log("  - " + h));
  }
  console.log("\n=== AGGREGATE OVER " + sample.length + " ARTICLES ===");
  for (const p of NG_PATTERNS) {
    const n = counts[p.name];
    const pct = Math.round((n / sample.length) * 100);
    console.log(`  ${p.name.padEnd(22)}  ${n}/${sample.length}  (${pct}%)`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
