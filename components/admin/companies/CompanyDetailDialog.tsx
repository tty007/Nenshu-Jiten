"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Heart,
  Loader2,
  Plus,
  Sparkles,
  Database,
  X,
  XCircle,
} from "lucide-react";
import { fetchAdminCompanyDetail } from "@/lib/admin/actions";
import { fetchArticlesForCompany } from "@/lib/admin/articles/actions";
import type { AdminCompanyDetail } from "@/lib/admin/get-admin-company-detail";
import type { AdminCompanyRow } from "@/lib/admin/get-admin-companies";
import { cn } from "@/lib/utils";

const TRANSITION_MS = 180;

const JST_DATE = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATE.format(d);
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATETIME.format(d);
}
function fmtNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("ja-JP");
}
function fmtSalary(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${Math.round(n / 10000).toLocaleString("ja-JP")} 万円`;
}
function fmtBigYen(n: number | null | undefined): string {
  if (n == null) return "-";
  if (Math.abs(n) >= 1_0000_0000)
    return `${(n / 1_0000_0000).toFixed(1)} 億円`;
  if (Math.abs(n) >= 10000)
    return `${(n / 10000).toFixed(1)} 万円`;
  return `${n.toLocaleString("ja-JP")} 円`;
}

type TabKey = "articles" | "data";

type Props = {
  open: boolean;
  /** モーダルを開く対象。table row から渡される。null なら閉じている扱い */
  company: AdminCompanyRow | null;
  onClose: () => void;
};

export function CompanyDetailDialog({ open, company, onClose }: Props) {
  const [shown, setShown] = useState(false);
  const [mountedDom, setMountedDom] = useState(false);
  // データ詳細タブの遅延ロード state
  const [data, setData] = useState<AdminCompanyDetail | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("articles");

  useEffect(() => {
    setMountedDom(true);
  }, []);

  // open / 対象企業切替時にタブと詳細データをリセット
  useEffect(() => {
    if (!open) return;
    setActiveTab("articles");
    setData(null);
    setDataError(null);
    setDataLoading(false);
  }, [open, company?.id]);

  // データ詳細タブが開かれ、かつまだ未ロードなら fetch。
  //
  // 重要: deps に dataLoading を含めない。含めると以下のループが発生する
  //   1. setDataLoading(true) → effect 再実行 → cleanup で cancelled=true
  //   2. fetch resolve しても cancelled=true で setDataLoading(false) されず
  //   3. ローディングが永久に残る
  //
  // データ取得済みかどうかの判定は data / dataError の有無のみで行う。
  useEffect(() => {
    if (!open) return;
    if (activeTab !== "data") return;
    if (!company?.id) return;
    if (data || dataError) return; // 既に取得済み or エラー保持中

    let cancelled = false;
    setDataLoading(true);
    setDataError(null);

    fetchAdminCompanyDetail(company.id)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setData(res.data);
        else setDataError(res.error);
      })
      .catch((e) => {
        if (!cancelled) setDataError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, company?.id]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setShown(false);
    window.setTimeout(() => {
      onClose();
      setData(null);
      setDataError(null);
    }, TRANSITION_MS);
  }

  if (!open || !mountedDom || !company) return null;

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="company-detail-title"
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out",
          shown ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-200 ease-out",
          shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        {/* ヘッダー（table row から渡された値で即時表示。fetch 不要） */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-border bg-white px-6 pt-4 pb-0">
          <div className="min-w-0 pb-3">
            <h2
              id="company-detail-title"
              className="flex items-center gap-2 text-base font-semibold text-ink"
            >
              <Building2 className="h-4 w-4 text-brand-600" />
              {company.name}
            </h2>
            <p className="mt-0.5 break-all text-xs text-ink-muted">
              {company.edinet_code}
              {company.securities_code && ` / ${company.securities_code}`}
              {company.industry_name && ` / ${company.industry_name}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-3">
            <Link
              href={`/companies/${company.edinet_code}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-100 hover:text-brand-700"
            >
              公開ページ
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex shrink-0 gap-0 border-b border-surface-border bg-white px-4">
          <TabButton
            active={activeTab === "articles"}
            onClick={() => setActiveTab("articles")}
            icon={<FileText className="h-3.5 w-3.5" />}
            label="記事一覧"
          />
          <TabButton
            active={activeTab === "data"}
            onClick={() => setActiveTab("data")}
            icon={<Database className="h-3.5 w-3.5" />}
            label="データ詳細"
          />
        </div>

        {/* 本体（残り高さを埋めて内部スクロール） */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* 記事一覧タブ：fetch なしで即時表示 */}
          {activeTab === "articles" && <ArticlesTab company={company} />}

          {/* データ詳細タブ：このタブを開いた時にだけ fetch */}
          {activeTab === "data" && (
            <>
              {dataLoading && (
                <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  読み込み中…
                </div>
              )}
              {dataError && (
                <div className="rounded-md border border-negative/30 bg-negative-50/40 p-3 text-sm text-negative-700">
                  {dataError}
                </div>
              )}
              {data && <DataTab data={data} />}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

// =====================================================================
// Tab button
// =====================================================================

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition",
        active
          ? "text-brand-700"
          : "text-ink-muted hover:text-ink"
      )}
    >
      {icon}
      {label}
      {count != null && (
        <span
          className={cn(
            "ml-1 rounded-full px-1.5 py-0.5 font-numeric text-[10px] tabular-nums",
            active ? "bg-brand-100 text-brand-700" : "bg-surface-muted text-ink-muted"
          )}
        >
          {count}
        </span>
      )}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-brand-600" />
      )}
    </button>
  );
}

// =====================================================================
// Tab 1: 記事一覧（記事システム未実装のため空状態）
// 現状は fetch なし（軽量）。記事テーブルが入ったらここに list fetch を足す
// =====================================================================

function ArticlesTab({ company }: { company: AdminCompanyRow }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">記事一覧</h3>
        <Link
          href={`/admin/articles/new?companyId=${company.id}`}
          className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-3.5 w-3.5" />
          新規作成
        </Link>
      </div>

      <ArticlesList companyId={company.id} />
    </div>
  );
}

function ArticlesList({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<
    | null
    | Array<{
        id: string;
        title: string;
        status: string;
        updated_at: string;
        company_count: number;
      }>
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchArticlesForCompany(companyId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setRows(res.data);
        else setError(res.error);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (error) {
    return (
      <div className="rounded-md border border-negative/30 bg-negative-50/40 p-3 text-sm text-negative-700">
        {error}
      </div>
    );
  }
  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        読み込み中…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-surface-border bg-surface-muted/20 px-6 py-12 text-center">
        <FileText className="h-8 w-8 text-ink-subtle" aria-hidden />
        <div>
          <p className="text-sm font-medium text-ink">この企業の記事はまだありません</p>
          <p className="mt-1 text-xs text-ink-subtle">
            上の「新規作成」から最初の記事を作成できます
          </p>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-surface-border rounded-md border border-surface-border bg-white">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/admin/articles/${r.id}`}
            className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-brand-50/40"
          >
            <div className="min-w-0">
              <div className="font-medium text-ink">
                {r.title || <span className="text-ink-subtle">（無題）</span>}
              </div>
              <div className="text-xs text-ink-muted">
                関連 {r.company_count} 社 ／ 更新 {new Date(r.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                r.status === "published"
                  ? "bg-positive-50 text-positive-700"
                  : r.status === "archived"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-surface-muted text-ink-muted"
              )}
            >
              {r.status === "published" ? "公開中" : r.status === "archived" ? "アーカイブ" : "下書き"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// =====================================================================
// Tab 2: データ詳細
// =====================================================================

function DataTab({ data }: { data: AdminCompanyDetail }) {
  const { company, metrics, raw_documents, mhlw, engagement } = data;

  return (
    <div className="space-y-6">
      {/* 概要文 */}
      {company.summary && (
        <section>
          <SectionTitle>会社概要（AI 生成）</SectionTitle>
          <p className="whitespace-pre-line rounded-md bg-surface-muted/40 p-3 text-sm leading-relaxed text-ink">
            {company.summary}
          </p>
          <p className="mt-1 text-right text-xs text-ink-subtle">
            生成: {fmtDateTime(company.summary_generated_at)}
            {company.summary_source_doc_id && (
              <> ／ 出典: {company.summary_source_doc_id}</>
            )}
          </p>
        </section>
      )}

      {/* 蓄積データのサマリー */}
      <section>
        <SectionTitle>蓄積データ</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <DataCard
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="財務指標 (financial_metrics)"
            value={`${metrics.count} 年度`}
            sub={
              metrics.count > 0
                ? `${metrics.earliest_year}〜${metrics.latest_year}`
                : "データなし"
            }
            tone={metrics.count > 0 ? "ok" : "warn"}
          />
          <DataCard
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="有報生データ (raw_xbrl_documents)"
            value={`${raw_documents.count} 件`}
            sub={
              raw_documents.count > 0
                ? `${fmtDate(raw_documents.earliest_submitted_at)}〜${fmtDate(raw_documents.latest_submitted_at)}`
                : "データなし"
            }
            tone={raw_documents.count > 0 ? "ok" : "warn"}
          />
          <DataCard
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="厚労省 女性活躍 (mhlw)"
            value={mhlw.exists ? "あり" : "なし"}
            sub={
              mhlw.exists
                ? `データ更新 ${fmtDate(mhlw.data_updated_at)} / 取込 ${fmtDate(mhlw.imported_at)}`
                : "未登録"
            }
            tone={mhlw.exists ? "ok" : "muted"}
          />
          <DataCard
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="会社概要 (companies.summary)"
            value={company.summary ? "生成済み" : "未生成"}
            sub={
              company.summary
                ? fmtDateTime(company.summary_generated_at)
                : "ETL で未生成"
            }
            tone={company.summary ? "ok" : "warn"}
          />
          <DataCard
            icon={<Heart className="h-3.5 w-3.5" />}
            label="お気に入り登録"
            value={`${engagement.favorites_count} 人`}
            sub="user_favorites 累計"
            tone={engagement.favorites_count > 0 ? "ok" : "muted"}
          />
          <DataCard
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="ページビュー (短縮 URL)"
            value={fmtNumber(engagement.page_views_total)}
            sub={
              company.securities_code
                ? `直近30日: ${fmtNumber(engagement.page_views_last_30d)}`
                : "証券コード無し（追跡不可）"
            }
            tone={engagement.page_views_total > 0 ? "ok" : "muted"}
          />
        </div>
      </section>

      {/* 最新の数値 */}
      {metrics.latest && (
        <section>
          <SectionTitle>最新の数値（{metrics.latest.fiscal_year}年度）</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-surface-muted/40 p-3 text-sm sm:grid-cols-3">
            <Field label="平均年収">{fmtSalary(metrics.latest.average_annual_salary)}</Field>
            <Field label="平均年齢">
              {metrics.latest.average_age != null ? `${metrics.latest.average_age} 歳` : "-"}
            </Field>
            <Field label="平均勤続">
              {metrics.latest.average_tenure_years != null
                ? `${metrics.latest.average_tenure_years} 年`
                : "-"}
            </Field>
            <Field label="従業員数">
              {fmtNumber(metrics.latest.employee_count)}{" "}
              {metrics.latest.employee_count != null && "人"}
            </Field>
            <Field label="女性管理職比率">
              {metrics.latest.female_manager_ratio != null
                ? `${metrics.latest.female_manager_ratio}%`
                : "-"}
            </Field>
            <Field label="残業時間（月平均）">
              {metrics.latest.average_overtime_hours != null
                ? `${metrics.latest.average_overtime_hours} 時間`
                : "-"}
            </Field>
            <Field label="売上">{fmtBigYen(metrics.latest.revenue)}</Field>
            <Field label="営業利益">{fmtBigYen(metrics.latest.operating_income)}</Field>
            <Field label="経常利益">{fmtBigYen(metrics.latest.ordinary_income)}</Field>
            <Field label="当期純利益">{fmtBigYen(metrics.latest.net_income)}</Field>
            <Field label="出典 doc_id">{metrics.latest.doc_id ?? "-"}</Field>
          </dl>
        </section>
      )}

      {/* 基本情報 */}
      <section>
        <SectionTitle>基本情報</SectionTitle>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-md bg-surface-muted/40 p-3 text-sm sm:grid-cols-2">
          <Field label="社名">{company.name}</Field>
          <Field label="社名カナ">{company.name_kana ?? "-"}</Field>
          <Field label="EDINET">{company.edinet_code}</Field>
          <Field label="証券コード">{company.securities_code ?? "-"}</Field>
          <Field label="法人番号">{company.corporate_number ?? "-"}</Field>
          <Field label="業界">{company.industry_name ?? "-"}</Field>
          <Field label="上場市場">{company.listed_market ?? "-"}</Field>
          <Field label="本社">{company.headquarters ?? "-"}</Field>
          <Field label="代表者">{company.representative ?? "-"}</Field>
          <Field label="設立">
            {company.founded_year ?? "-"}
            {company.founded_year && "年"}
            {company.founded_at && ` (${company.founded_at})`}
          </Field>
          <Field label="資本金">{fmtBigYen(company.capital_stock_yen)}</Field>
          <Field label="決算月">
            {company.fiscal_year_end_month != null
              ? `${company.fiscal_year_end_month}月`
              : "-"}
          </Field>
          <Field label="公式サイト">
            {company.website_url ? (
              <a
                href={company.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-600 hover:underline"
              >
                {company.website_url}
              </a>
            ) : (
              "-"
            )}
          </Field>
          <Field label="DB 登録">{fmtDateTime(company.created_at)}</Field>
          <Field label="DB 更新">{fmtDateTime(company.updated_at)}</Field>
        </dl>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </h3>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

type DataCardTone = "ok" | "warn" | "muted";
const TONE_BG: Record<DataCardTone, string> = {
  ok: "border-positive/30 bg-positive-50/40",
  warn: "border-amber-200 bg-amber-50/40",
  muted: "border-surface-border bg-surface-muted/30",
};
const TONE_ICON: Record<DataCardTone, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-positive-600" />,
  warn: <XCircle className="h-4 w-4 text-amber-600" />,
  muted: <XCircle className="h-4 w-4 text-ink-subtle" />,
};

function DataCard({
  icon,
  label,
  value,
  sub,
  tone = "ok",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: DataCardTone;
}) {
  return (
    <div className={cn("rounded-md border p-3", TONE_BG[tone])}>
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        {TONE_ICON[tone]}
      </div>
      <div className="mt-1.5 font-numeric text-lg font-semibold tabular-nums text-ink">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-subtle">{sub}</div>}
    </div>
  );
}
