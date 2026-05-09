// 「同一有報で既に記事がある？」「リライトすべき？」の判定ロジック。
// プレビュー (UI のスコープ表示)、起票時の事前削減、ワーカー実行時の再評価
// の 3 箇所で同じ関数を共有する。
//
// service_role 前提で動くので、createSupabaseAdminClient で受け取った
// Supabase クライアントを引数に取る純関数として書く（admin 認証チェックは
// 呼び出し側の責任）。

import type { SupabaseClient } from "@supabase/supabase-js";

export type LatestYuhoRow = {
  company_id: string;
  doc_id: string | null;
  fiscal_year: number | null;
  submitted_at: string | null;
};

/**
 * 各企業の「最新の有報 (financial_metrics で submitted_at が最も新しい行)」を一括取得。
 * doc_id が null の行は除外。
 */
export async function loadLatestYuhoForCompanies(
  sb: SupabaseClient,
  companyIds: string[]
): Promise<Map<string, LatestYuhoRow>> {
  if (companyIds.length === 0) return new Map();

  // financial_metrics は (company_id, fiscal_year) ユニーク。
  // submitted_at desc → company_id 内で最初に出てきた 1 行を採用。
  const r = await sb
    .from("financial_metrics")
    .select("company_id, doc_id, fiscal_year, submitted_at")
    .in("company_id", companyIds)
    .not("submitted_at", "is", null)
    .not("doc_id", "is", null)
    .order("submitted_at", { ascending: false });

  if (r.error) throw new Error(`loadLatestYuho: ${r.error.message}`);

  const out = new Map<string, LatestYuhoRow>();
  for (const row of r.data ?? []) {
    const cid = row.company_id as string;
    if (out.has(cid)) continue; // 既に最新を保持済み
    out.set(cid, {
      company_id: cid,
      doc_id: (row.doc_id ?? null) as string | null,
      fiscal_year: (row.fiscal_year ?? null) as number | null,
      submitted_at: (row.submitted_at ?? null) as string | null,
    });
  }
  return out;
}

export type ExistingSalaryArticle = {
  article_id: string;
  /** 既存記事に紐付く article_xbrl_documents の最新提出日 */
  article_yuho_submitted: string | null;
  /** 同上の doc_id (最も新しい submitted_at のもの) */
  article_doc_id: string | null;
  /** articles.updated_at — 手動編集判定で使う場合の参考値（v1 では使わない） */
  article_updated_at: string | null;
  /** articles.category_id — 既に salary が設定されているかの確認用 */
  category_id: string | null;
};

/**
 * 「ある企業の年収記事」を 1 件取得する（複数あれば updated_at が最新の 1 件）。
 *
 * 条件:
 *   - article_companies に company_id が含まれている
 *   - status <> 'archived'
 *   - articles.category_id に紐付く article_categories.slug = 'salary'
 *   - article_xbrl_documents が 1 件以上あること（テンプレ生成由来である目印）
 */
export async function findExistingSalaryArticleForCompany(
  sb: SupabaseClient,
  companyId: string
): Promise<ExistingSalaryArticle | null> {
  // 候補の article_id をまず広めに引く（category_id NULL のレガシーも一旦含める）
  const cand = await sb
    .from("article_companies")
    .select(
      "article_id, articles!inner(id, status, updated_at, category_id, article_categories(slug))"
    )
    .eq("company_id", companyId);

  if (cand.error) {
    throw new Error(
      `findExistingSalaryArticleForCompany: ${cand.error.message}`
    );
  }

  type Article = {
    id: string;
    status: string;
    updated_at: string;
    category_id: string | null;
    article_categories: { slug: string } | { slug: string }[] | null;
  };
  type Row = {
    article_id: string;
    articles: Article | Article[] | null;
  };

  const rawRows = (cand.data ?? []) as unknown as Row[];
  const filtered: Array<{ article_id: string; article: Article }> = [];
  for (const r of rawRows) {
    const article = Array.isArray(r.articles) ? r.articles[0] : r.articles;
    if (!article) continue;
    if (article.status === "archived") continue;
    const c = article.article_categories;
    const slug = Array.isArray(c) ? c[0]?.slug : c?.slug;
    if (slug !== "salary") continue;
    filtered.push({ article_id: r.article_id, article });
  }

  if (filtered.length === 0) return null;

  // テンプレ由来であることを担保：article_xbrl_documents が 1 件以上ある
  const ids = filtered.map((r) => r.article_id);
  const xbrl = await sb
    .from("article_xbrl_documents")
    .select("article_id, doc_id, submitted_at")
    .in("article_id", ids);
  if (xbrl.error) {
    throw new Error(`article_xbrl_documents: ${xbrl.error.message}`);
  }

  const xbrlByArticle = new Map<
    string,
    Array<{ doc_id: string; submitted_at: string | null }>
  >();
  for (const r of xbrl.data ?? []) {
    const aid = r.article_id as string;
    const list = xbrlByArticle.get(aid) ?? [];
    list.push({
      doc_id: r.doc_id as string,
      submitted_at: (r.submitted_at ?? null) as string | null,
    });
    xbrlByArticle.set(aid, list);
  }

  // テンプレ由来候補のみ残す
  const withXbrl = filtered.filter(
    (r) => (xbrlByArticle.get(r.article_id) ?? []).length > 0
  );
  if (withXbrl.length === 0) return null;

  // updated_at 最新を採用
  withXbrl.sort((a, b) => {
    const au = a.article.updated_at ?? "";
    const bu = b.article.updated_at ?? "";
    return bu.localeCompare(au);
  });
  const top = withXbrl[0];
  const xbrlList = (xbrlByArticle.get(top.article_id) ?? []).slice();
  xbrlList.sort((a, b) => {
    const ad = a.submitted_at ?? "";
    const bd = b.submitted_at ?? "";
    return bd.localeCompare(ad);
  });
  const latestXbrl = xbrlList[0];

  return {
    article_id: top.article_id,
    article_yuho_submitted: latestXbrl?.submitted_at ?? null,
    article_doc_id: latestXbrl?.doc_id ?? null,
    article_updated_at: top.article.updated_at ?? null,
    category_id: top.article.category_id ?? null,
  };
}

/**
 * バルク版：companyIds の各企業について「年収カテゴリの既存記事」を一括で引く。
 * プレビューや起票時の N+1 を避けるため。
 *
 * 戻り値は company_id → ExistingSalaryArticle (なければエントリなし)。
 */
export async function findExistingSalaryArticlesBulk(
  sb: SupabaseClient,
  companyIds: string[]
): Promise<Map<string, ExistingSalaryArticle>> {
  if (companyIds.length === 0) return new Map();

  // 1) salary カテゴリの id を引く（slug='salary' の active カテゴリ）
  const catRes = await sb
    .from("article_categories")
    .select("id")
    .eq("slug", "salary");
  if (catRes.error) {
    throw new Error(`article_categories: ${catRes.error.message}`);
  }
  const salaryCategoryIds = (catRes.data ?? []).map(
    (r: { id: string }) => r.id
  );
  if (salaryCategoryIds.length === 0) return new Map();

  // 2) company_id ごとに article_companies を引いて、salary 記事に絞る
  const acRes = await sb
    .from("article_companies")
    .select(
      "company_id, article_id, articles!inner(id, status, updated_at, category_id)"
    )
    .in("company_id", companyIds);
  if (acRes.error) {
    throw new Error(`article_companies bulk: ${acRes.error.message}`);
  }

  type Article = {
    id: string;
    status: string;
    updated_at: string;
    category_id: string | null;
  };
  type Row = {
    company_id: string;
    article_id: string;
    articles: Article | Article[] | null;
  };

  const candidates: Array<{
    company_id: string;
    article_id: string;
    updated_at: string;
    category_id: string | null;
  }> = [];
  for (const r of (acRes.data ?? []) as unknown as Row[]) {
    const a = Array.isArray(r.articles) ? r.articles[0] : r.articles;
    if (!a) continue;
    if (a.status === "archived") continue;
    if (!a.category_id || !salaryCategoryIds.includes(a.category_id)) continue;
    candidates.push({
      company_id: r.company_id,
      article_id: r.article_id,
      updated_at: a.updated_at,
      category_id: a.category_id,
    });
  }
  if (candidates.length === 0) return new Map();

  // 3) これらの記事に紐付く article_xbrl_documents を一括取得
  const articleIds = Array.from(new Set(candidates.map((c) => c.article_id)));
  const xbrl = await sb
    .from("article_xbrl_documents")
    .select("article_id, doc_id, submitted_at")
    .in("article_id", articleIds);
  if (xbrl.error) {
    throw new Error(`article_xbrl_documents bulk: ${xbrl.error.message}`);
  }
  const xbrlByArticle = new Map<
    string,
    Array<{ doc_id: string; submitted_at: string | null }>
  >();
  for (const r of xbrl.data ?? []) {
    const aid = r.article_id as string;
    const list = xbrlByArticle.get(aid) ?? [];
    list.push({
      doc_id: r.doc_id as string,
      submitted_at: (r.submitted_at ?? null) as string | null,
    });
    xbrlByArticle.set(aid, list);
  }

  // 4) company_id ごとに updated_at 最新の salary 記事を選ぶ
  const byCompany = new Map<string, ExistingSalaryArticle>();
  // updated_at 降順でソートしてから走査すると、各 company に最初に当たった 1 件が最新
  candidates.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  for (const c of candidates) {
    if (byCompany.has(c.company_id)) continue;
    const xbrlList = (xbrlByArticle.get(c.article_id) ?? []).slice();
    if (xbrlList.length === 0) continue; // テンプレ由来でない記事は除外
    xbrlList.sort((a, b) => {
      const ad = a.submitted_at ?? "";
      const bd = b.submitted_at ?? "";
      return bd.localeCompare(ad);
    });
    const top = xbrlList[0];
    byCompany.set(c.company_id, {
      article_id: c.article_id,
      article_yuho_submitted: top.submitted_at,
      article_doc_id: top.doc_id,
      article_updated_at: c.updated_at,
      category_id: c.category_id,
    });
  }
  return byCompany;
}

export type SkipRewriteDecision =
  | { kind: "create" }
  | { kind: "rewrite"; article_id: string; existing: ExistingSalaryArticle }
  | {
      kind: "skip";
      reason:
        | "same_yuho"
        | "same_yuho_at_runtime"
        | "no_metrics"
        | "rewrite_disabled"
        | "no_newer_yuho";
      article_id?: string;
    };

/**
 * 1 企業ぶんの判定。
 *
 * - latest が無い → skip(no_metrics)
 * - 既存記事なし → create
 * - 既存記事の article_doc_id == latest.doc_id（同一有報）
 *     - skipExisting=true → skip(same_yuho)
 *     - skipExisting=false → rewrite（同じ doc_id でも強制で本文を再生成して上書き）
 * - 既存記事より新しい有報 (latest.submitted_at > article_yuho_submitted)
 *     - rewriteIfNewerYuho=true → rewrite
 *     - rewriteIfNewerYuho=false → skip(rewrite_disabled)
 * - それ以外（古い／同等で別 doc_id） → skip(no_newer_yuho)
 *
 * `runtime` フラグ付きで呼ぶと same_yuho を same_yuho_at_runtime に変換する。
 * これにより UI で「実行直前に新しい有報が降ってきてスキップになった」が判別できる。
 */
export function decideSkipOrRewrite(args: {
  latest: LatestYuhoRow | null | undefined;
  existing: ExistingSalaryArticle | null | undefined;
  rewriteIfNewerYuho: boolean;
  /** 同一有報の既存記事をスキップする（false なら強制リライト） */
  skipExisting: boolean;
  runtime?: boolean;
}): SkipRewriteDecision {
  const { latest, existing, rewriteIfNewerYuho, skipExisting, runtime } = args;

  if (!latest || !latest.doc_id) {
    return { kind: "skip", reason: "no_metrics" };
  }

  if (!existing) {
    return { kind: "create" };
  }

  if (
    existing.article_doc_id &&
    latest.doc_id === existing.article_doc_id
  ) {
    // 同一 doc_id：skipExisting によって挙動が変わる
    if (skipExisting) {
      return {
        kind: "skip",
        reason: runtime ? "same_yuho_at_runtime" : "same_yuho",
        article_id: existing.article_id,
      };
    }
    // skipExisting=false：同じ有報でも強制リライト
    return { kind: "rewrite", article_id: existing.article_id, existing };
  }

  const targetTs = latest.submitted_at
    ? new Date(latest.submitted_at).getTime()
    : 0;
  const articleTs = existing.article_yuho_submitted
    ? new Date(existing.article_yuho_submitted).getTime()
    : 0;

  if (targetTs > articleTs) {
    if (!rewriteIfNewerYuho) {
      return {
        kind: "skip",
        reason: "rewrite_disabled",
        article_id: existing.article_id,
      };
    }
    return { kind: "rewrite", article_id: existing.article_id, existing };
  }

  // target が古い／同等で別 doc_id
  return {
    kind: "skip",
    reason: "no_newer_yuho",
    article_id: existing.article_id,
  };
}
