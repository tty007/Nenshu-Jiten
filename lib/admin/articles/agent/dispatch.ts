import "server-only";

// GitHub REST API の workflow_dispatch を叩いて articles-agent.yml を起動する。
// 認証は GH_AGENT_DISPATCH_TOKEN（fine-grained PAT、actions:write）を使う。

const WORKFLOW_FILE = "articles-agent.yml";

function envOrNull(key: string): string | null {
  const v = process.env[key];
  return v && v.trim() ? v : null;
}

/**
 * リポジトリの owner/name を環境変数から取得。
 * GITHUB_REPO_OWNER / GITHUB_REPO_NAME を優先し、無ければ GITHUB_REPOSITORY (= "owner/name") を見る。
 */
function resolveRepo(): { owner: string; repo: string } | null {
  const owner = envOrNull("GITHUB_REPO_OWNER");
  const repo = envOrNull("GITHUB_REPO_NAME");
  if (owner && repo) return { owner, repo };
  const combined = envOrNull("GITHUB_REPOSITORY");
  if (combined && combined.includes("/")) {
    const [o, r] = combined.split("/");
    return { owner: o, repo: r };
  }
  return null;
}

export type DispatchResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * articles-agent.yml を workflow_dispatch で起動する。
 *
 * 失敗しても agent_jobs.status は queued のまま残るので、
 * 30分ごとのスイープが再ディスパッチを試みる。
 *
 * デフォルトブランチ ref は環境変数 GH_AGENT_DISPATCH_REF か "main"。
 */
export async function dispatchAgentWorker(args: {
  jobId: string;
  maxMinutes?: number;
  concurrency?: number;
}): Promise<DispatchResult> {
  const token = envOrNull("GH_AGENT_DISPATCH_TOKEN");
  if (!token) {
    return {
      ok: false,
      error: "GH_AGENT_DISPATCH_TOKEN が設定されていません",
    };
  }
  const repo = resolveRepo();
  if (!repo) {
    return {
      ok: false,
      error:
        "GITHUB_REPO_OWNER / GITHUB_REPO_NAME (または GITHUB_REPOSITORY) が必要です",
    };
  }

  const ref = envOrNull("GH_AGENT_DISPATCH_REF") ?? "main";
  const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          job_id: args.jobId,
          max_minutes: String(args.maxMinutes ?? 300),
          concurrency: String(args.concurrency ?? 1),
        },
      }),
    });
  } catch (e) {
    return { ok: false, error: `network: ${(e as Error).message}` };
  }

  // workflow_dispatch は成功時 204 No Content
  if (res.status === 204) return { ok: true };
  const body = await res.text().catch(() => "");
  return {
    ok: false,
    error: `HTTP ${res.status}: ${body.slice(0, 300)}`,
  };
}
