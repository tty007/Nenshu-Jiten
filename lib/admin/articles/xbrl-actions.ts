"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";

// =====================================================================
// 型
// =====================================================================

/** 記事に紐付いている有報書類 1 件分（チップ表示・リスト表示で使用） */
export type ArticleXbrlDocChip = {
  doc_id: string;
  edinet_code: string | null;
  fiscal_year: number | null;
  submitted_at: string | null;
  filer_name: string | null;
  display_order: number;
};

/** 検索結果（ピッカーモーダル用） */
export type XbrlDocSearchResult = {
  doc_id: string;
  edinet_code: string;
  fiscal_year: number | null;
  submitted_at: string | null;
  filer_name: string | null;
  /** companies.name（紐付くマスタがあれば優先表示） */
  company_name: string | null;
};

type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

// =====================================================================
// 取得
// =====================================================================

export async function listArticleXbrlDocs(
  articleId: string
): Promise<ActionResult<ArticleXbrlDocChip[]>> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const sb = createSupabaseAdminClient();
  const r = await sb
    .from("article_xbrl_documents")
    .select(
      "doc_id, edinet_code, fiscal_year, submitted_at, filer_name, display_order"
    )
    .eq("article_id", articleId)
    .order("display_order", { ascending: true })
    .order("submitted_at", { ascending: false });
  if (r.error) return { ok: false, error: r.error.message };
  return { ok: true, data: (r.data ?? []) as ArticleXbrlDocChip[] };
}

// =====================================================================
// 追加 / 削除
// =====================================================================

/**
 * 記事に有報書類を 1 件追加する。
 * doc_id 単位で重複チェック（既に紐付いている場合は no-op で ok を返す）。
 *
 * raw_xbrl_documents から取れるメタ情報（fiscal_year / submitted_at / filer_name /
 * edinet_code）も冗長保存する。raw_xbrl_documents に存在しない doc_id は
 * 引数の override（オプション）で渡せる。
 */
export async function addArticleXbrlDoc(
  articleId: string,
  docId: string,
  override?: {
    edinet_code?: string | null;
    fiscal_year?: number | null;
    submitted_at?: string | null;
    filer_name?: string | null;
  }
): Promise<ActionResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  if (!docId.trim()) return { ok: false, error: "doc_id が空です" };

  const sb = createSupabaseAdminClient();

  // 既に紐付いていれば no-op
  const exists = await sb
    .from("article_xbrl_documents")
    .select("doc_id")
    .eq("article_id", articleId)
    .eq("doc_id", docId)
    .maybeSingle();
  if (exists.data) return { ok: true };

  // raw_xbrl_documents から取得（任意。あれば冗長フィールドを埋める）
  let edinet_code = override?.edinet_code ?? null;
  let fiscal_year = override?.fiscal_year ?? null;
  let submitted_at = override?.submitted_at ?? null;
  let filer_name = override?.filer_name ?? null;
  if (
    edinet_code == null ||
    fiscal_year == null ||
    submitted_at == null ||
    filer_name == null
  ) {
    const meta = await sb
      .from("raw_xbrl_documents")
      .select("edinet_code, fiscal_year, submitted_at, filer_name")
      .eq("doc_id", docId)
      .maybeSingle();
    if (meta.data) {
      edinet_code = edinet_code ?? (meta.data.edinet_code ?? null);
      fiscal_year = fiscal_year ?? (meta.data.fiscal_year ?? null);
      submitted_at = submitted_at ?? (meta.data.submitted_at ?? null);
      filer_name = filer_name ?? (meta.data.filer_name ?? null);
    }
  }

  // display_order: 末尾に append
  const max = await sb
    .from("article_xbrl_documents")
    .select("display_order")
    .eq("article_id", articleId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (max.data?.display_order ?? -1) + 1;

  const ins = await sb.from("article_xbrl_documents").insert({
    article_id: articleId,
    doc_id: docId,
    edinet_code,
    fiscal_year,
    submitted_at,
    filer_name,
    display_order: nextOrder,
  });
  if (ins.error) return { ok: false, error: ins.error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath(`/admin/articles/${articleId}/preview`);
  return { ok: true };
}

export async function removeArticleXbrlDoc(
  articleId: string,
  docId: string
): Promise<ActionResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const sb = createSupabaseAdminClient();
  const r = await sb
    .from("article_xbrl_documents")
    .delete()
    .eq("article_id", articleId)
    .eq("doc_id", docId);
  if (r.error) return { ok: false, error: r.error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath(`/admin/articles/${articleId}/preview`);
  return { ok: true };
}

// =====================================================================
// 検索（ピッカー用）
// =====================================================================

/**
 * 有報書類を検索する。
 *
 * - 既に articleId に紐付いている doc_id はリストから除外
 * - companyEdinetCodes が指定されたら、そのいずれかの企業の有報に絞る
 * - query は doc_id / edinet_code / filer_name に対する部分一致
 */
export async function searchAvailableXbrlDocs(args: {
  articleId: string;
  query?: string;
  companyEdinetCodes?: string[];
  limit?: number;
}): Promise<ActionResult<XbrlDocSearchResult[]>> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const sb = createSupabaseAdminClient();
  const limit = Math.max(1, Math.min(args.limit ?? 50, 200));

  let q = sb
    .from("raw_xbrl_documents")
    .select(
      "doc_id, edinet_code, fiscal_year, submitted_at, filer_name"
    )
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (args.companyEdinetCodes && args.companyEdinetCodes.length > 0) {
    q = q.in("edinet_code", args.companyEdinetCodes);
  }

  const trimmed = (args.query ?? "").trim();
  if (trimmed) {
    const esc = trimmed.replace(/[%_,]/g, " ");
    q = q.or(
      `doc_id.ilike.%${esc}%,edinet_code.ilike.%${esc}%,filer_name.ilike.%${esc}%`
    );
  }

  const r = await q;
  if (r.error) return { ok: false, error: r.error.message };
  const docs = r.data ?? [];

  // 既に紐付いている doc_id を除外
  const linked = await sb
    .from("article_xbrl_documents")
    .select("doc_id")
    .eq("article_id", args.articleId);
  const linkedSet = new Set(
    (linked.data ?? []).map((r: { doc_id: string }) => r.doc_id)
  );

  // companies.name があれば紐付け表示
  const edinetCodes = Array.from(
    new Set(docs.map((d: any) => d.edinet_code).filter(Boolean))
  );
  let nameByEdinet = new Map<string, string>();
  if (edinetCodes.length > 0) {
    const cRes = await sb
      .from("companies")
      .select("edinet_code, name")
      .in("edinet_code", edinetCodes);
    if (!cRes.error && cRes.data) {
      for (const c of cRes.data) {
        nameByEdinet.set(c.edinet_code as string, c.name as string);
      }
    }
  }

  const out: XbrlDocSearchResult[] = docs
    .filter((d: any) => !linkedSet.has(d.doc_id))
    .map((d: any) => ({
      doc_id: d.doc_id,
      edinet_code: d.edinet_code,
      fiscal_year: d.fiscal_year,
      submitted_at: d.submitted_at,
      filer_name: d.filer_name,
      company_name: d.edinet_code ? nameByEdinet.get(d.edinet_code) ?? null : null,
    }));

  return { ok: true, data: out };
}

// =====================================================================
// 自動リンク（テンプレ反映時に呼ぶ）
// =====================================================================

/**
 * 記事に紐付く各企業について「financial_metrics の最新行の doc_id」を
 * article_xbrl_documents に紐付ける。既にあるものはスキップ。
 *
 * テンプレ生成 → エディタ反映の直後に呼ぶことで、生成元の有報を構造化して残す。
 */
export async function autoLinkXbrlDocsForArticle(
  articleId: string
): Promise<
  | { ok: true; data: { added: number; skipped: number } }
  | { ok: false; error: string }
> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const sb = createSupabaseAdminClient();

  const acRes = await sb
    .from("article_companies")
    .select("company_id")
    .eq("article_id", articleId);
  if (acRes.error) return { ok: false, error: acRes.error.message };
  const companyIds = (acRes.data ?? []).map((r) => r.company_id as string);
  if (companyIds.length === 0) return { ok: true, data: { added: 0, skipped: 0 } };

  // 既に紐付いている doc_id 集合
  const linked = await sb
    .from("article_xbrl_documents")
    .select("doc_id")
    .eq("article_id", articleId);
  const linkedSet = new Set(
    (linked.data ?? []).map((r: { doc_id: string }) => r.doc_id)
  );

  // 各企業の最新 financial_metric を取得
  const fmRes = await sb
    .from("financial_metrics")
    .select("company_id, fiscal_year, doc_id, submitted_at")
    .in("company_id", companyIds)
    .order("fiscal_year", { ascending: false });
  if (fmRes.error) return { ok: false, error: fmRes.error.message };

  // 各 company の最新行のみ採用
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

  // companies の edinet_code / name を取得（冗長フィールド埋め用）
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
  let nextOrder = (max.data?.display_order ?? -1) + 1;

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

  if (rowsToInsert.length === 0) {
    return { ok: true, data: { added: 0, skipped } };
  }

  const ins = await sb.from("article_xbrl_documents").insert(rowsToInsert);
  if (ins.error) return { ok: false, error: ins.error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath(`/admin/articles/${articleId}/preview`);
  return { ok: true, data: { added: rowsToInsert.length, skipped } };
}
