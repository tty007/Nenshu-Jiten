"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

export type CommandItem = {
  /** 表示名 */
  title: string;
  /** 補足説明 */
  description: string;
  /** 検索用の追加キーワード（カナ含む） */
  searchTerms?: string[];
  /** lucide icon 等 */
  icon: React.ReactNode;
  /** 選択時に実行 */
  command: (props: { editor: any; range: any }) => void;
};

type Props = {
  items: CommandItem[];
  command: (item: CommandItem) => void;
};

export type SlashCommandListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export const SlashCommandList = forwardRef<SlashCommandListRef, Props>(
  function SlashCommandList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex(
            (selectedIndex + items.length - 1) % Math.max(1, items.length)
          );
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((selectedIndex + 1) % Math.max(1, items.length));
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    const grouped = useMemo(() => items, [items]);

    if (grouped.length === 0) {
      return (
        <div className="rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-ink-subtle shadow-lg">
          該当するコマンドがありません
        </div>
      );
    }

    return (
      <div className="max-h-80 w-72 overflow-y-auto rounded-lg border border-surface-border bg-white p-1 shadow-lg">
        {grouped.map((item, idx) => (
          <button
            key={item.title}
            type="button"
            onClick={() => selectItem(idx)}
            onMouseEnter={() => setSelectedIndex(idx)}
            className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left transition ${
              idx === selectedIndex ? "bg-brand-50" : "hover:bg-surface-muted/50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border ${
                idx === selectedIndex
                  ? "border-brand-200 bg-white text-brand-700"
                  : "border-surface-border bg-white text-ink-muted"
              }`}
            >
              {item.icon}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{item.title}</div>
              <div className="truncate text-xs text-ink-subtle">
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);
