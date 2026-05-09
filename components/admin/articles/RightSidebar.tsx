"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  FolderTree,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyChip } from "./CompanySelector";
import { SalaryTemplateDialog } from "./SalaryTemplateDialog";

const STORAGE_KEY = "admin-article-right-sidebar-open";

type Template = {
  id: "salary";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  description: string;
  /** 自動付与されるカテゴリ（記事生成時に articles.category_id へ反映） */
  category: { name: string; slug: string };
};

const TEMPLATES: Template[] = [
  {
    id: "salary",
    title: "年収分析記事",
    subtitle: "salary",
    icon: <Sparkles className="h-4 w-4" />,
    description:
      "「会社名 年収」クエリを狙う記事を生成するテンプレートです。サービス内データを用いて動的に記事を生成します。",
    category: { name: "年収", slug: "salary" },
  },
];

type Props = {
  articleId: string;
  companies: CompanyChip[];
  /** 既に記事に設定されている著者 id（テンプレ反映の初期値に使う） */
  initialAuthorId?: string | null;
  onInsert: (html: string) => void;
  onInsertAtCursor?: (html: string) => void;
  onReplace: (html: string) => void;
  /** タイトル反映フック（ArticleEditor の title state を上書きする） */
  onApplyTitle?: (title: string) => void;
  /** カテゴリ自動セット（slug 指定） */
  onApplyCategoryBySlug?: (slugPath: string) => Promise<void> | void;
  /** 著者自動セット（id 指定。null は未設定にリセット） */
  onApplyAuthor?: (authorId: string | null) => Promise<void> | void;
  /** 紐付き企業の最新有報を articles に自動リンク */
  onAutoLinkXbrlDocs?: () => Promise<void> | void;
};

export function RightSidebar({
  articleId,
  companies,
  initialAuthorId,
  onInsert,
  onInsertAtCursor,
  onReplace,
  onApplyTitle,
  onApplyCategoryBySlug,
  onApplyAuthor,
  onAutoLinkXbrlDocs,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template["id"] | null>(
    null
  );

  // localStorage の永続化（初期化）
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setOpen(true);
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  // localStorage 反映
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [open, hydrated]);

  const toggle = () => setOpen((v) => !v);

  return (
    <>
      {/* ===== 右サイドバー本体（ツマミ + パネル）===== */}
      {/* z-30 はサイトヘッダー (z-? ふつうは 50) より下、編集画面 sticky バー (z-20) より上 */}
      <aside
        aria-label="記事テンプレート"
        className={cn(
          "fixed right-0 top-24 z-30 flex transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-[calc(100%-40px)]"
        )}
        style={{ height: "calc(100vh - 7rem)" }}
      >
        {/* ツマミ：上部のみのタブ。クリックで開閉 */}
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? "テンプレートを閉じる" : "テンプレートを開く"}
          aria-expanded={open}
          title={open ? "閉じる" : "テンプレート"}
          className={cn(
            "group flex h-16 w-10 shrink-0 cursor-pointer items-center justify-center self-start rounded-l-lg border border-r-0 border-surface-border bg-white shadow-md transition hover:bg-brand-50 hover:text-brand-700",
            open && "bg-brand-50 text-brand-700"
          )}
        >
          {open ? (
            <PanelRightClose
              className="h-5 w-5 text-ink-muted transition group-hover:text-brand-700"
              aria-hidden
            />
          ) : (
            <PanelRightOpen
              className="h-5 w-5 text-ink-muted transition group-hover:-translate-x-0.5 group-hover:text-brand-700"
              aria-hidden
            />
          )}
        </button>

        {/* パネル本体：320px 固定、独立スクロール */}
        <div className="flex h-full w-80 flex-col overflow-hidden rounded-l-xl border border-r-0 border-surface-border bg-white shadow-2xl">
          <header className="shrink-0 border-b border-surface-border px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <FileText className="h-4 w-4 text-ink-muted" />
              テンプレート
            </h3>
            <p className="mt-0.5 text-xs text-ink-subtle">
              ワンクリックで構造化された本文を生成し、エディタに反映できます。
            </p>
          </header>

          <ul className="flex-1 space-y-2 overflow-y-auto p-3">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActiveTemplate(t.id)}
                  className="group block w-full rounded-lg p-3 text-left transition hover:bg-brand-50"
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:text-brand-700">
                    {t.icon}
                    <span>{t.title}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink-subtle">
                    {t.subtitle}
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-muted/50 px-1.5 py-0.5 text-[11px] text-ink-muted">
                    <FolderTree className="h-3 w-3" aria-hidden />
                    <span>カテゴリ：{t.category.name}</span>
                    <span className="font-mono text-ink-subtle">/{t.category.slug}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                    {t.description}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          <footer className="shrink-0 border-t border-surface-border bg-surface-muted/30 px-4 py-2 text-[11px] text-ink-subtle">
            紐付き企業：
            {companies.length === 0 ? (
              <span className="text-amber-700">未設定</span>
            ) : (
              <span className="text-ink">
                {companies[0].name}
                {companies.length > 1 ? ` ほか ${companies.length - 1} 社` : ""}
              </span>
            )}
          </footer>
        </div>
      </aside>

      {/* ===== モーダルダイアログ ===== */}
      {activeTemplate === "salary" && (
        <SalaryTemplateDialog
          open
          onClose={() => setActiveTemplate(null)}
          articleId={articleId}
          company={companies[0] ?? null}
          initialAuthorId={initialAuthorId}
          onInsert={onInsert}
          onInsertAtCursor={onInsertAtCursor}
          onReplace={onReplace}
          onApplyTitle={onApplyTitle}
          onApplyCategoryBySlug={onApplyCategoryBySlug}
          onApplyAuthor={onApplyAuthor}
          onAutoLinkXbrlDocs={onAutoLinkXbrlDocs}
          onAfterApply={() => setOpen(false)}
        />
      )}
    </>
  );
}
