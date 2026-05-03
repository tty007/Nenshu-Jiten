"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortKey } from "@/lib/data/companies";

const TRANSITION_MS = 200;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "salary", label: "平均年収順" },
  { key: "tenure", label: "勤続年数順" },
  { key: "employees", label: "従業員数順" },
  { key: "revenue", label: "売上高順" },
  { key: "recent", label: "新着順" },
];

// 年収レンジの最大値（万円単位）
const SALARY_MAX = 3000;
const SALARY_STEP = 50;

export type FilterState = {
  industryCodes: string[];
  sort: SortKey;
  salaryMin: number; // 万円
  salaryMax: number; // 万円。SALARY_MAX 以上は「無制限」
};

type Industry = { code: string; name: string };

export function SearchFilterButton({
  industries,
  current,
  query,
}: {
  industries: Industry[];
  current: FilterState;
  query: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [draft, setDraft] = useState<FilterState>(current);

  // モーダル表示前に最新の current で draft を初期化
  function open() {
    setDraft(current);
    setMounted(true);
  }
  function close() {
    setShown(false);
    window.setTimeout(() => setMounted(false), TRANSITION_MS);
  }

  useEffect(() => {
    if (!mounted) return;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const activeCount = countActive(current);

  function applyAndClose() {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (draft.industryCodes.length > 0)
      sp.set("industry", draft.industryCodes.join(","));
    if (draft.sort && draft.sort !== "salary") sp.set("sort", draft.sort);
    if (draft.salaryMin > 0) sp.set("salaryMin", String(draft.salaryMin));
    if (draft.salaryMax < SALARY_MAX) sp.set("salaryMax", String(draft.salaryMax));
    const qs = sp.toString();
    router.push(qs ? `/search?${qs}` : "/search");
    close();
  }

  function reset() {
    setDraft({
      industryCodes: [],
      sort: "salary",
      salaryMin: 0,
      salaryMax: SALARY_MAX,
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="relative inline-flex shrink-0 items-center gap-2 rounded-full border border-surface-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand-100 hover:bg-brand-50/40 hover:text-brand-700"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        フィルタ
        {activeCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
      {mounted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-filter-title"
        >
          <div
            className={cn(
              "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out",
              shown ? "opacity-100" : "opacity-0"
            )}
            onClick={close}
            aria-hidden
          />
          <div
            className={cn(
              "relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-200 ease-out",
              shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-border bg-white px-6 py-4 sm:px-8">
              <h2
                id="search-filter-title"
                className="text-base font-semibold text-ink"
              >
                絞り込み・並び替え
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="閉じる"
                className="-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
              {/* 業界（複数選択） */}
              <div>
                <p className="text-sm font-semibold text-ink">業界（複数選択可）</p>
                <IndustryMultiSelect
                  industries={industries}
                  selected={draft.industryCodes}
                  onChange={(codes) =>
                    setDraft({ ...draft, industryCodes: codes })
                  }
                />
              </div>

              {/* 並び順 */}
              <div>
                <p className="text-sm font-semibold text-ink">並び順</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SORT_OPTIONS.map((opt) => {
                    const active = draft.sort === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDraft({ ...draft, sort: opt.key })}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                          active
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-surface-border bg-white text-ink-muted hover:border-brand-100 hover:text-brand-700"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 平均年収レンジ */}
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-ink">平均年収</p>
                  <p className="font-numeric text-sm tabular-nums text-ink-muted">
                    {formatRange(draft.salaryMin, draft.salaryMax)}
                  </p>
                </div>
                <DualRangeSlider
                  min={0}
                  max={SALARY_MAX}
                  step={SALARY_STEP}
                  valueMin={draft.salaryMin}
                  valueMax={draft.salaryMax}
                  onChange={(min, max) =>
                    setDraft({ ...draft, salaryMin: min, salaryMax: max })
                  }
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-surface-border bg-white px-6 py-4 sm:px-8">
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-ink-muted hover:text-ink"
              >
                条件をリセット
              </button>
              <button
                type="button"
                onClick={applyAndClose}
                className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-blue-700 to-sky-400 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-800 hover:to-sky-500"
              >
                この条件で表示
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function countActive(s: FilterState): number {
  let n = 0;
  if (s.industryCodes.length > 0) n++;
  if (s.sort && s.sort !== "salary") n++;
  if (s.salaryMin > 0 || s.salaryMax < SALARY_MAX) n++;
  return n;
}

function IndustryMultiSelect({
  industries,
  selected,
  onChange,
}: {
  industries: Industry[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  function toggle(code: string) {
    if (selectedSet.has(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  }
  function clear() {
    onChange([]);
  }

  const triggerLabel =
    selected.length === 0
      ? "すべての業界"
      : selected.length === 1
      ? industries.find((i) => i.code === selected[0])?.name ?? "1 業界を選択中"
      : `${selected.length} 業界を選択中`;

  return (
    <div ref={containerRef} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-left text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected.length === 0 ? "text-ink-muted" : "text-ink"
          )}
        >
          {triggerLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-muted transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-surface-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-surface-border px-3 py-2">
            <span className="text-xs text-ink-muted">
              {selected.length}/{industries.length} 選択中
            </span>
            <button
              type="button"
              onClick={clear}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:text-ink-subtle"
              disabled={selected.length === 0}
            >
              すべてクリア
            </button>
          </div>
          <ul
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 overflow-y-auto py-1"
          >
            {industries.map((ind) => {
              const checked = selectedSet.has(ind.code);
              return (
                <li key={ind.code} role="option" aria-selected={checked}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors",
                      checked
                        ? "bg-brand-50/60 text-ink"
                        : "text-ink hover:bg-surface-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded border transition",
                        checked
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-surface-border bg-white"
                      )}
                      aria-hidden
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{ind.name}</span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggle(ind.code)}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatRange(min: number, max: number): string {
  const minLabel = min === 0 ? "下限なし" : `${min.toLocaleString("ja-JP")}万円〜`;
  const maxLabel =
    max >= SALARY_MAX ? "上限なし" : `〜${max.toLocaleString("ja-JP")}万円`;
  if (min === 0 && max >= SALARY_MAX) return "指定なし";
  if (min === 0) return maxLabel;
  if (max >= SALARY_MAX) return minLabel;
  return `${min.toLocaleString("ja-JP")}〜${max.toLocaleString("ja-JP")}万円`;
}

// 二段重ねの range input でデュアルハンドルスライダーを実現。
// 各 input は track 部分は pointer-events:none、thumb だけ auto にすることで
// 重なった状態でも両方の thumb がドラッグ可能。
const SLIDER_INPUT_CLASS =
  "dual-range absolute inset-0 h-full w-full appearance-none bg-transparent";

function DualRangeSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
}) {
  const left = useMemo(
    () => ((valueMin - min) / (max - min)) * 100,
    [valueMin, min, max]
  );
  const right = useMemo(
    () => 100 - ((valueMax - min) / (max - min)) * 100,
    [valueMax, min, max]
  );

  return (
    <div className="mt-3">
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-muted" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-700 to-sky-400"
          style={{ left: `${left}%`, right: `${right}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), valueMax - step);
            onChange(Math.max(min, v), valueMax);
          }}
          aria-label="平均年収の下限"
          className={SLIDER_INPUT_CLASS}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), valueMin + step);
            onChange(valueMin, Math.min(max, v));
          }}
          aria-label="平均年収の上限"
          className={SLIDER_INPUT_CLASS}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-subtle">
        <span>{min.toLocaleString("ja-JP")}万円</span>
        <span>{max.toLocaleString("ja-JP")}万円〜</span>
      </div>
    </div>
  );
}
