"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Loader2, Plus, Search, X } from "lucide-react";
import {
  addArticleXbrlDoc,
  removeArticleXbrlDoc,
  searchAvailableXbrlDocs,
  type ArticleXbrlDocChip,
  type XbrlDocSearchResult,
} from "@/lib/admin/articles/xbrl-actions";
import { cn } from "@/lib/utils";

type Props = {
  articleId: string;
  initialDocs: ArticleXbrlDocChip[];
  /** 紐付き企業の EDINET コード（ピッカー初期フィルタに使う）*/
  companyEdinetCodes?: string[];
  /** 変化通知 */
  onChange?: (docs: ArticleXbrlDocChip[]) => void;
};

const FY_LABEL = (fy: number | null) => (fy != null ? `FY ${fy}` : "FY —");

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

const edinetUrl = (edinetCode: string | null) =>
  edinetCode
    ? `https://disclosure2.edinet-fsa.go.jp/WEEK0010.aspx?uji.verb=W1E62071EdinetCodeSearch&uji.bean=ee.bean.W1E62071.EE1E62071Bean&TID=W1E62071&PID=W1E62071&edinetCode=${encodeURIComponent(edinetCode)}`
    : null;

export function XbrlDocSelector({
  articleId,
  initialDocs,
  companyEdinetCodes,
  onChange,
}: Props) {
  const [docs, setDocs] = useState<ArticleXbrlDocChip[]>(initialDocs);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onChange?.(docs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  // 親からの initialDocs 更新（テンプレ反映で auto-link が走った直後など）に追従
  useEffect(() => {
    setDocs(initialDocs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocs.map((d) => d.doc_id).join(",")]);

  const handleAdd = (r: XbrlDocSearchResult) => {
    if (docs.some((d) => d.doc_id === r.doc_id)) {
      setPickerOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addArticleXbrlDoc(articleId, r.doc_id, {
        edinet_code: r.edinet_code,
        fiscal_year: r.fiscal_year,
        submitted_at: r.submitted_at,
        filer_name: r.company_name ?? r.filer_name,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDocs((prev) => [
        ...prev,
        {
          doc_id: r.doc_id,
          edinet_code: r.edinet_code,
          fiscal_year: r.fiscal_year,
          submitted_at: r.submitted_at,
          filer_name: r.company_name ?? r.filer_name,
          display_order: prev.length,
        },
      ]);
      setPickerOpen(false);
    });
  };

  const handleRemove = (docId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeArticleXbrlDoc(articleId, docId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDocs((prev) => prev.filter((d) => d.doc_id !== docId));
    });
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {docs.map((d) => {
          const url = edinetUrl(d.edinet_code);
          return (
            <span
              key={d.doc_id}
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white py-1 pl-3 pr-1 text-sm text-ink"
            >
              <span className="font-mono text-xs text-ink-muted">
                {FY_LABEL(d.fiscal_year)}
              </span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-mono text-xs underline-offset-2 hover:underline"
                  title="EDINET で開く"
                >
                  {d.doc_id}
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                </a>
              ) : (
                <span className="font-mono text-xs">{d.doc_id}</span>
              )}
              {d.filer_name && (
                <span className="max-w-[14ch] truncate text-xs text-ink-subtle">
                  {d.filer_name}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(d.doc_id)}
                disabled={isPending}
                className="rounded-full p-1 text-ink-muted hover:bg-negative-50 hover:text-negative-700 disabled:opacity-40"
                title={`${d.doc_id} を紐付けから外す`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-border bg-white px-3 py-1 text-sm text-ink-muted hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          有報を追加
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-negative-700">{error}</p>}

      {pickerOpen && (
        <XbrlDocPickerDialog
          articleId={articleId}
          excludeDocIds={new Set(docs.map((d) => d.doc_id))}
          defaultEdinetCodes={companyEdinetCodes ?? []}
          onPick={handleAdd}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// =====================================================================
// ピッカーダイアログ
// =====================================================================

function XbrlDocPickerDialog({
  articleId,
  excludeDocIds,
  defaultEdinetCodes,
  onPick,
  onClose,
}: {
  articleId: string;
  excludeDocIds: Set<string>;
  defaultEdinetCodes: string[];
  onPick: (r: XbrlDocSearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [scopeToCompanies, setScopeToCompanies] = useState(
    defaultEdinetCodes.length > 0
  );
  const [results, setResults] = useState<XbrlDocSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 検索（debounce）
  useEffect(() => {
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      const res = await searchAvailableXbrlDocs({
        articleId,
        query: query.trim() || undefined,
        companyEdinetCodes:
          scopeToCompanies && defaultEdinetCodes.length > 0
            ? defaultEdinetCodes
            : undefined,
        limit: 50,
      });
      if (res.ok) {
        setResults(res.data);
      } else {
        setError(res.error);
      }
      setLoading(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, scopeToCompanies, articleId, defaultEdinetCodes]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-surface-border">
          <div className="flex items-center gap-2 px-4 py-3">
            <Search className="h-4 w-4 text-ink-subtle" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="doc_id・EDINET コード・提出者名で検索"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-ink-subtle"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {defaultEdinetCodes.length > 0 && (
            <div className="flex items-center gap-2 border-t border-surface-border bg-surface-muted/40 px-4 py-2 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-ink-muted">
                <input
                  type="checkbox"
                  checked={scopeToCompanies}
                  onChange={(e) => setScopeToCompanies(e.target.checked)}
                  className="accent-brand-600"
                />
                関連企業の有報のみ表示（{defaultEdinetCodes.length} 社）
              </label>
            </div>
          )}
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              検索中…
            </div>
          )}
          {error && (
            <p className="px-4 py-3 text-sm text-negative-700">{error}</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">
              該当する有報がありません
            </p>
          )}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-surface-border">
              {results.map((r) => {
                const already = excludeDocIds.has(r.doc_id);
                return (
                  <li key={r.doc_id}>
                    <button
                      type="button"
                      onClick={() => !already && onPick(r)}
                      disabled={already}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50/40",
                        already &&
                          "cursor-not-allowed bg-surface-muted/30 hover:bg-surface-muted/30"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-xs text-ink-muted">
                            {FY_LABEL(r.fiscal_year)}
                          </span>
                          <span className="font-mono text-ink">
                            {r.doc_id}
                          </span>
                          <span className="text-xs text-ink-subtle">
                            {fmtDate(r.submitted_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-ink-muted">
                          {r.company_name ?? r.filer_name ?? "—"}
                          {r.edinet_code && (
                            <span className="ml-1 font-mono text-ink-subtle">
                              {r.edinet_code}
                            </span>
                          )}
                        </div>
                      </div>
                      {already && (
                        <span className="shrink-0 text-xs text-ink-subtle">
                          追加済み
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
