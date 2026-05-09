import { notFound } from "next/navigation";
import { AgentJobDetailLive } from "@/components/admin/articles/agent/AgentJobDetailLive";
import {
  getAgentJobDetail,
  listAgentJobTasks,
} from "@/lib/admin/articles/agent/data";

export const metadata = { title: "ジョブ詳細 — 記事制作エージェント" };
export const dynamic = "force-dynamic";
// resumeAgentJob 等の after() 処理が走るので、Vercel Pro の上限近くを確保する。
export const maxDuration = 300;

type Params = { jobId: string };

export default async function AgentJobDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { jobId } = await params;
  const job = await getAgentJobDetail(jobId);
  if (!job) notFound();
  const tasks = await listAgentJobTasks(jobId, { limit: 500 });

  // GitHub Actions のリポジトリ別 URL を生成
  const repo =
    process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
      ? `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
      : process.env.GITHUB_REPOSITORY ?? null;
  const ghActionsUrl = repo
    ? `https://github.com/${repo}/actions/workflows/articles-agent.yml`
    : null;

  return (
    <AgentJobDetailLive
      initialJob={job}
      initialTasks={tasks}
      ghActionsUrl={ghActionsUrl}
    />
  );
}
