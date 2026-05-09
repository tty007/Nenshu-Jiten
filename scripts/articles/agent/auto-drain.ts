/**
 * 自動ピックアップ版ドレイン。GitHub Actions の schedule cron から定期起動される。
 *
 * 1) 期限切れリースを開放
 * 2) queued または heartbeat 切れ running のジョブを 1 件選ぶ
 * 3) なければ即終了（runner 起動コストのみ）
 * 4) あれば drain-runner で処理
 *
 * これにより、ブラウザからジョブ追加 → 最大 5 分以内に自動で起動する。
 * GitHub PAT (GH_AGENT_DISPATCH_TOKEN) 設定なしでも動作する。
 */

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import {
  drainUntilBudgetOut,
  releaseExpiredLeases,
} from "@/lib/articles/agent/drain-runner";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function clampInt(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function parseArgs(argv: string[]) {
  const map: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return {
    maxMinutes: clampInt(
      Number(map.maxMinutes ?? process.env.AGENT_MAX_MINUTES ?? "300"),
      5,
      350
    ),
    concurrency: clampInt(
      Number(map.concurrency ?? process.env.AGENT_CONCURRENCY ?? "1"),
      1,
      3
    ),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  envOrThrow("OPENAI_API_KEY");
  const sb = createClient(
    envOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
    envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
  const runId = process.env.GH_RUN_ID ?? `local-${Date.now().toString(36)}`;

  console.log(`[auto-drain] starting run=${runId}`);

  // 期限切れリースを解放（孤児タスクを別 worker が拾えるようにする）
  try {
    const released = await releaseExpiredLeases(sb);
    if (released > 0) {
      console.log(`[auto-drain] released ${released} expired task leases`);
    }
  } catch (e) {
    console.warn(`[auto-drain] release leases: ${(e as Error).message}`);
  }

  // 直列実行ポリシー：同時に複数ジョブを並走させない。
  // drainUntilBudgetOut は内部で findNextClaimableJobId をループするので、
  // 1 ジョブが完了したら次の queued ジョブに自然と移る（ギャップなし）。
  const result = await drainUntilBudgetOut(sb, {
    maxMinutes: args.maxMinutes,
    concurrency: args.concurrency,
    runId,
  });
  if (result.jobs === 0) {
    console.log(`[auto-drain] no claimable job, exit (idle run)`);
  } else {
    console.log(
      `[auto-drain] drained jobs=${result.jobs} lastFinalized=${result.lastResult?.finalized ?? "n/a"}`
    );
  }
}

main()
  .catch((e) => {
    console.error("[auto-drain] fatal:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
