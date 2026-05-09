// Vercel after() チェーンの受信エンドポイント。
//
// 内部呼び出し専用。SUPABASE_SERVICE_ROLE_KEY を共有シークレットとして検証する。
// レスポンスは即座に 200 を返し、after() で 4 分ぶん runDrainJob → 必要なら
// 自分自身に再 POST して連鎖継続。
//
// このエンドポイントは外部に晒れている扱いだが、シークレット未一致は 401 で
// はじくので、ブラウザや curl で叩かれても動かない。

import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isAnotherJobActive,
  runDrainJob,
} from "@/lib/articles/agent/drain-runner";
import {
  CHAIN_HEADERS,
  MAX_CHAIN_DEPTH,
  triggerNextChain,
} from "@/lib/articles/agent/chain";

export const dynamic = "force-dynamic";
// runDrainJob を 4 分間呼ぶので 5 分の上限近くを確保。
export const maxDuration = 300;

export async function POST(req: Request) {
  // 認証
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const provided = req.headers.get(CHAIN_HEADERS.SECRET);
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let jobId: string;
  try {
    const body = await req.json();
    jobId = String(body.jobId ?? "");
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!jobId) {
    return new Response(JSON.stringify({ ok: false, error: "jobId 必須" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const depth = parseInt(req.headers.get(CHAIN_HEADERS.DEPTH) ?? "0", 10) || 0;

  after(async () => {
    try {
      const sb = createSupabaseAdminClient();
      // 直列ポリシー：別ジョブが走っているなら何もしない（cron に任せる）
      if (await isAnotherJobActive(sb, jobId)) {
        return;
      }
      const result = await runDrainJob({
        sb,
        jobId,
        maxMinutes: 4,
        concurrency: 1,
        runId: `vercel-chain-${depth}-${Date.now().toString(36)}`,
        verbose: false,
      });
      // pending が残っていてキャンセル/ポーズでもなければ次のチェーンへ
      if (
        !result.finalized &&
        !result.paused &&
        result.remainingPending > 0 &&
        depth < MAX_CHAIN_DEPTH
      ) {
        await triggerNextChain({ jobId, depth });
      }
    } catch (e) {
      console.warn(
        `[continue] chain link failed at depth=${depth}: ${(e as Error).message}`
      );
    }
  });

  return new Response(
    JSON.stringify({ ok: true, depth }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
