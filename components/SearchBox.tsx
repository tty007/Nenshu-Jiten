"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { cn } from "@/lib/utils";
import type { SuggestItem } from "@/app/api/search/suggest/route";

type Props = {
  defaultValue?: string;
  size?: "sm" | "lg";
  className?: string;
};

const DEBOUNCE_MS = 180;

export function SearchBox({ defaultValue = "", size = "lg", className }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);
  const listboxId = useId();

  const isLarge = size === "lg";
  const trimmed = useMemo(() => value.trim(), [value]);

  // 入力に対するデバウンス付きの suggest フェッチ
  useEffect(() => {
    if (!trimmed) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: SuggestItem[] };
        setItems(data.items ?? []);
        setActiveIndex(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          // ignore other errors silently
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(id);
      ctrl.abort();
    };
  }, [trimmed]);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      goTo(items[activeIndex].edinetCode);
      return;
    }
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function goTo(edinetCode: string) {
    setOpen(false);
    router.push(`/companies/${edinetCode}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && trimmed.length > 0;

  return (
    <form
      ref={containerRef}
      onSubmit={onSubmit}
      className={cn(
        "relative flex w-full items-center",
        isLarge ? "max-w-2xl" : "max-w-md",
        className
      )}
      role="search"
    >
      <Search
        className={cn(
          "absolute left-4 text-ink-subtle",
          isLarge ? "h-5 w-5" : "h-4 w-4"
        )}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="企業名・証券コードで検索"
        aria-label="企業を検索"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={showDropdown}
        aria-activedescendant={
          showDropdown && activeIndex >= 0
            ? `${listboxId}-${activeIndex}`
            : undefined
        }
        autoComplete="off"
        className={cn(
          "w-full rounded-full border border-surface-border bg-white pl-12 pr-28 outline-none transition",
          "focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
          "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          isLarge ? "h-14 text-base" : "h-10 text-sm"
        )}
      />
      <button
        type="submit"
        className={cn(
          "absolute right-2 rounded-full bg-gradient-to-r from-blue-700 to-sky-400 px-5 font-medium text-white transition hover:from-blue-800 hover:to-sky-500",
          isLarge ? "h-11 text-sm" : "h-7 px-3 text-base"
        )}
      >
        検索
      </button>

      {showDropdown && items.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-surface-border bg-white shadow-xl"
        >
          {items.map((item, i) => (
            <li
              key={item.edinetCode}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={activeIndex === i}
            >
              <Link
                href={`/companies/${item.edinetCode}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors",
                  activeIndex === i
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink hover:bg-brand-50/60"
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.name}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                  {item.industryName && (
                    <span className="hidden sm:inline">
                      {item.industryName}
                    </span>
                  )}
                  {item.securitiesCode && (
                    <span className="font-numeric tabular-nums">
                      {item.securitiesCode}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
