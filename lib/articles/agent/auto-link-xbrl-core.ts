// xbrl-actions.ts の autoLinkXbrlDocsForArticle を、admin 認証を介さずに
// 任意の SupabaseClient（service_role）から呼べるコア版にしたもの。
// ワーカープロセス（Node スクリプト）からも安全に呼べる。

import type { SupabaseClient } from "@supabase/supabase-js";

export async function autoLinkXbrlDocsCore(
  sb: SupabaseClient,
  articleId: string
): Promise<{ added: number; skipped: number }> {
  const acRes = await sb
    .from("article_companies")
    .select("company_id")
    .eq("article_id", articleId);
  if (acRes.error) throw new Error(`article_companies: ${acRes.error.message}`);
  const companyIds = (acRes.data ?? []).map(
    (r: { company_id: string }) => r.company_id
  );
  if (companyIds.length === 0) return { added: 0, skipped: 0 };

  const linked = await sb
    .from("article_xbrl_documents")
    .select("doc_id")
    .eq("article_id", articleId);
  const linkedSet = new Set(
    (linked.data ?? []).map((r: { doc_id: string }) => r.doc_id)
  );

  const fmRes = await sb
    .from("financial_metrics")
    .select("company_id, fiscal_year, doc_id, submitted_at")
    .in("company_id", companyIds)
    .order("fiscal_year", { ascending: false });
  if (fmRes.error) throw new Error(`financial_metrics: ${fmRes.error.message}`);

  const latestByCompany = new Map<
    string,
    { fiscal_year: number; doc_id: string | null; submitted_at: string | null }
  >();
  for (const m of fmRes.data ?? []) {
    const cid = m.company_id as string;
    if (latestByCompany.has(cid)) continue;
    latestByCompany.set(cid, {
      fiscal_year: m.fiscal_year as number,
      doc_id: (m.doc_id ?? null) as string | null,
      submitted_at: (m.submitted_at ?? null) as string | null,
    });
  }

  const cRes = await sb
    .from("companies")
    .select("id, edinet_code, name")
    .in("id", companyIds);
  const companyById = new Map<string, { edinet_code: string; name: string }>();
  for (const c of cRes.data ?? []) {
    companyById.set(c.id as string, {
      edinet_code: c.edinet_code as string,
      name: c.name as string,
    });
  }

  const max = await sb
    .from("article_xbrl_documents")
    .select("display_order")
    .eq("article_id", articleId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextOrder = ((max.data?.display_order ?? -1) as number) + 1;

  const rowsToInsert: Array<Record<string, unknown>> = [];
  let skipped = 0;
  for (const [cid, m] of latestByCompany) {
    if (!m.doc_id) {
      skipped++;
      continue;
    }
    if (linkedSet.has(m.doc_id)) {
      skipped++;
      continue;
    }
    const c = companyById.get(cid);
    rowsToInsert.push({
      article_id: articleId,
      doc_id: m.doc_id,
      edinet_code: c?.edinet_code ?? null,
      fiscal_year: m.fiscal_year ?? null,
      submitted_at: m.submitted_at ?? null,
      filer_name: c?.name ?? null,
      display_order: nextOrder++,
    });
  }

  if (rowsToInsert.length === 0) return { added: 0, skipped };

  const ins = await sb.from("article_xbrl_documents").insert(rowsToInsert);
  if (ins.error) throw new Error(`insert article_xbrl_documents: ${ins.error.message}`);

  return { added: rowsToInsert.length, skipped };
}
