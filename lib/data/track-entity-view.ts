import "server-only";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 企業 / 記事ページの PV を、エンティティ ID 単位でアトミック +1 する。
 *
 * - server component / route handler から fire-and-forget で呼ぶ
 * - 個人を識別する情報は送らないので Cookie 同意は不要
 * - User-Agent ベースで主要なボットを弾く（厳密ではないが十分）
 * - 失敗時はサイレント（PV 取得失敗で本機能を落とさない）
 *
 * Next.js のプリフェッチ等でカウントが膨れる可能性はあるが、
 * 内部分析用途であれば許容できる精度。
 */

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /headless/i,
  /lighthouse/i,
  /pingdom/i,
  /facebookexternalhit/i,
  /whatsapp/i,
  /slackbot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /discordbot/i,
  /chrome-lighthouse/i,
];

async function isBotRequest(): Promise<boolean> {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (!ua) return true; // UA なしは怪しいので弾く
  return BOT_PATTERNS.some((re) => re.test(ua));
}

function todayJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function trackCompanyView(companyId: string): Promise<void> {
  if (!companyId) return;
  if (await isBotRequest()) return;
  try {
    const sb = createSupabaseAdminClient();
    await sb.rpc("increment_company_view", {
      p_company_id: companyId,
      p_date: todayJst(),
    });
  } catch {
    // 集計失敗で本ページの描画を止めない
  }
}

export async function trackArticleView(articleId: string): Promise<void> {
  if (!articleId) return;
  if (await isBotRequest()) return;
  try {
    const sb = createSupabaseAdminClient();
    await sb.rpc("increment_article_view", {
      p_article_id: articleId,
      p_date: todayJst(),
    });
  } catch {
    // 集計失敗で本ページの描画を止めない
  }
}
