// Vercel after() のチェーン継続トリガー。
//
// after() の中で、まだ pending タスクが残っているかつ paused/cancelled でなければ
// /api/agent/continue を fire-and-forget で叩く。受信側が新しい Vercel 関数で
// 次の 4 分ぶんを処理。これを連鎖することで cron なしで連続実行を実現する。
//
// 認証は SUPABASE_SERVICE_ROLE_KEY を内部シークレットとして共有
// （Vercel 環境変数に既にあるので追加設定不要）。

const CHAIN_HEADER_DEPTH = "x-chain-depth";
const CHAIN_HEADER_SECRET = "x-internal-secret";
/** 暴走防止の上限。50 段 × 4 分 ≒ 3 時間ぶん。実際のジョブはこれより前に finalized する。 */
export const MAX_CHAIN_DEPTH = 50;

function resolveBaseUrl(): string | null {
  // 本番 / preview: VERCEL_URL（先頭プロトコルなし）
  // ローカル dev: NEXT_PUBLIC_SITE_URL or http://localhost:3000
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return null;
}

/**
 * 次のチェーンリンクを起動する。fire-and-forget でレスポンスを待たない。
 * jobId と現在の depth を渡し、受信側で depth+1 を確認して暴走を防ぐ。
 */
export async function triggerNextChain(args: {
  jobId: string;
  depth: number;
}): Promise<void> {
  const baseUrl = resolveBaseUrl();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !secret) {
    console.warn(
      "[chain] cannot trigger next: VERCEL_URL or SUPABASE_SERVICE_ROLE_KEY missing"
    );
    return;
  }
  if (args.depth >= MAX_CHAIN_DEPTH) {
    console.warn(
      `[chain] depth limit reached (${args.depth}); stopping chain. Cron will pick up.`
    );
    return;
  }
  try {
    const res = await fetch(`${baseUrl}/api/agent/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAIN_HEADER_SECRET]: secret,
        [CHAIN_HEADER_DEPTH]: String(args.depth + 1),
      },
      body: JSON.stringify({ jobId: args.jobId }),
    });
    if (!res.ok) {
      console.warn(
        `[chain] trigger failed: HTTP ${res.status}. Cron will pick up.`
      );
    }
  } catch (e) {
    console.warn(
      `[chain] trigger error: ${(e as Error).message}. Cron will pick up.`
    );
  }
}

export const CHAIN_HEADERS = {
  DEPTH: CHAIN_HEADER_DEPTH,
  SECRET: CHAIN_HEADER_SECRET,
};
