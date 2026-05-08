"use client";

import { useState, type ReactNode } from "react";
import { Building2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  infoTab: ReactNode;
  contentTab: ReactNode;
  /** コンテンツタブの記事数（バッジ表示用） */
  articleCount: number;
};

type TabKey = "info" | "content";

export function CompanyTabs({ infoTab, contentTab, articleCount }: Props) {
  const [active, setActive] = useState<TabKey>("info");

  return (
    <div className="mt-8">
      {/* タブヘッダー */}
      <div
        role="tablist"
        aria-label="企業ページのセクション切替"
        className="flex w-full border-b border-surface-border"
      >
        <TabButton
          isActive={active === "info"}
          onClick={() => setActive("info")}
          icon={<Building2 className="h-4 w-4" />}
        >
          企業データ
        </TabButton>
        <TabButton
          isActive={active === "content"}
          onClick={() => setActive("content")}
          icon={<FileText className="h-4 w-4" />}
          badge={articleCount > 0 ? articleCount : undefined}
        >
          コンテンツ
        </TabButton>
      </div>

      {/* タブパネル：両方サーバー描画済み。display を切り替えるだけで状態保持 */}
      <div
        role="tabpanel"
        aria-labelledby="tab-info"
        className={active === "info" ? "" : "hidden"}
      >
        {infoTab}
      </div>
      <div
        role="tabpanel"
        aria-labelledby="tab-content"
        className={active === "content" ? "" : "hidden"}
      >
        {contentTab}
      </div>
    </div>
  );
}

function TabButton({
  isActive,
  onClick,
  icon,
  badge,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: ReactNode;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold transition",
        isActive
          ? "text-brand-700"
          : "text-ink-muted hover:bg-surface-muted/40 hover:text-ink"
      )}
    >
      {icon}
      <span>{children}</span>
      {badge != null && (
        <span
          className={cn(
            "ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
            isActive
              ? "bg-brand-100 text-brand-700"
              : "bg-surface-muted text-ink-muted"
          )}
        >
          {badge}
        </span>
      )}
      {/* 下線：active 時に青グラデ */}
      {isActive && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-[2.5px] rounded-t"
          style={{
            background:
              "linear-gradient(90deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)",
          }}
        />
      )}
    </button>
  );
}
