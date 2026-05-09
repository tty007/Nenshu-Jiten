import { Bot } from "lucide-react";
import { AgentJobCreateButton } from "@/components/admin/articles/agent/AgentJobCreateButton";
import { AgentJobList } from "@/components/admin/articles/agent/AgentJobList";
import { AgentJobStatsCards } from "@/components/admin/articles/agent/AgentJobStatsCards";
import {
  getAgentDashboardStats,
  listAgentJobs,
} from "@/lib/admin/articles/agent/data";

export const metadata = { title: "記事制作エージェント" };
export const dynamic = "force-dynamic";
// createAgentJob の after() で 1〜3 件分のドレインを直接走らせるため、
// Vercel Pro の上限ぎりぎりの 300 秒を確保する（after() は同じ関数寿命を共有する）。
export const maxDuration = 300;

export default async function ArticleAgentPage() {
  const [jobs, stats] = await Promise.all([
    listAgentJobs({ limit: 50 }),
    getAgentDashboardStats(),
  ]);
  const nextDispatchLabel =
    stats.activeJobs > 0 ? "今すぐ" : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-brand-700">
            <Bot className="h-3.5 w-3.5" aria-hidden />
            Beta
          </div>
          <h1 className="mt-2 text-2xl font-bold text-ink">
            記事制作エージェント
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            テンプレートを選んで対象企業を指定すると、エージェントが下書きを自動生成します。実行は GitHub Actions のワーカーが順次処理し、必要に応じて再ディスパッチを繰り返します。
          </p>
        </div>
        <AgentJobCreateButton />
      </header>

      <AgentJobStatsCards
        activeJobs={stats.activeJobs}
        articlesThisMonth={stats.articlesThisMonth}
        nextDispatchLabel={nextDispatchLabel}
      />

      <AgentJobList jobs={jobs} />

      <section className="rounded-2xl border border-dashed border-surface-border bg-surface-soft/40 p-6 text-xs text-ink-muted">
        <h2 className="text-sm font-semibold text-ink">処理ルール</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>既に同一の有報 (doc_id) で生成済みの記事はスキップ</li>
          <li>既存記事より新しい有報がある場合は強制上書きで再生成</li>
          <li>
            生成された記事は <strong>下書き</strong> 状態で保存（公開は手動）
          </li>
          <li>
            ジョブはバックグラウンドで進み、Vercel の関数タイムアウトの影響を受けません
          </li>
        </ul>
      </section>
    </div>
  );
}
