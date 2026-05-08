"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Search, X, Loader2 } from "lucide-react";
import {
  addCompanyToArticle,
  removeCompanyFromArticle,
  searchCompaniesForEditor,
} from "@/lib/admin/articles/actions";

export type CompanyChip = {
  id: string;
  edinet_code: string;
  name: string;
  industry_name: string | null;
};

type SearchResult = {
  id: string;
  edinet_code: string;
  name: string;
  name_kana: string | null;
  industry_name: string | null;
};

type Props = {
  articleId: string;
  initialCompanies: CompanyChip[];
  /** 企業リストが変化した時に親へ通知（紐付き企業数を AI 執筆機能で使うため）*/
  onChange?: (companies: CompanyChip[]) => void;
};

export function CompanySelector({
  articleId,
  initialCompanies,
  onChange,
}: Props) {
  const [companies, setCompanies] = useState<CompanyChip[]>(initialCompanies);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // companies が変わるたびに親へ通知
  useEffect(() => {
    onChange?.(companies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies]);

  const handleAdd = (c: SearchResult) => {
    if (companies.some((x) => x.id === c.id)) {
      setPickerOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addCompanyToArticle(articleId, c.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCompanies((prev) => [
        ...prev,
        {
          id: c.id,
          edinet_code: c.edinet_code,
          name: c.name,
          industry_name: c.industry_name,
        },
      ]);
      setPickerOpen(false);
    });
  };

  const handleRemove = (companyId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeCompanyFromArticle(articleId, companyId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {companies.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white py-1 pl-3 pr-1 text-sm text-ink"
          >
            <span className="font-medium">{c.name}</span>
            <span className="text-xs text-ink-subtle">{c.edinet_code}</span>
            <button
              type="button"
              onClick={() => handleRemove(c.id)}
              disabled={isPending}
              className="rounded-full p-1 text-ink-muted hover:bg-negative-50 hover:text-negative-700 disabled:opacity-40"
              title={`${c.name} を関連から外す`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-border bg-white px-3 py-1 text-sm text-ink-muted hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          企業を追加
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-negative-700">{error}</p>
      )}
      {pickerOpen && (
        <CompanyPickerDialog
          excludeIds={new Set(companies.map((c) => c.id))}
          onPick={handleAdd}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// =====================================================================
// 検索ダイアログ（インライン dropdown でなく中央モーダル）
// =====================================================================

function CompanyPickerDialog({
  excludeIds,
  onPick,
  onClose,
}: {
  excludeIds: Set<string>;
  onPick: (c: SearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // mount 時に input フォーカス
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 入力 debounce 検索
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      const res = await searchCompaniesForEditor(q);
      if (res.ok) {
        setResults(res.data);
      } else {
        setError(res.error);
      }
      setLoading(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/50 p-4 pt-[10vh]">
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <Search className="h-4 w-4 text-ink-subtle" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="社名・カナ・EDINET・証券コードで検索"
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

        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              検索中…
            </div>
          )}
          {error && (
            <p className="px-4 py-3 text-sm text-negative-700">{error}</p>
          )}
          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">
              該当企業がありません
            </p>
          )}
          {!loading && !query.trim() && (
            <p className="px-4 py-6 text-center text-sm text-ink-subtle">
              キーワードを入力してください
            </p>
          )}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-surface-border">
              {results.map((r) => {
                const already = excludeIds.has(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => !already && onPick(r)}
                      disabled={already}
                      className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:bg-surface-muted/30 disabled:hover:bg-surface-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-ink">{r.name}</div>
                        <div className="text-xs text-ink-muted">
                          {r.edinet_code}
                          {r.industry_name && ` / ${r.industry_name}`}
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
