"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type RankingTabKey =
  | "salary"
  | "tenure"
  | "employees"
  | "revenue"
  | "recent";

export type RankingItem = {
  id: string;
  edinetCode: string;
  name: string;
  valueLabel: string;
};

const TABS: { key: RankingTabKey; label: string }[] = [
  { key: "salary", label: "平均年収ランキング" },
  { key: "tenure", label: "勤続年数ランキング" },
  { key: "employees", label: "従業員数ランキング" },
  { key: "revenue", label: "売上ランキング" },
  { key: "recent", label: "新着" },
];

export function HomeRankingTabs({
  data,
}: {
  data: Record<RankingTabKey, RankingItem[]>;
}) {
  const [active, setActive] = useState<RankingTabKey>("salary");
  const items = data[active];
  return (
    <>
      <div className="mt-5 -mx-4 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2 sm:gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              aria-pressed={active === t.key}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                active === t.key
                  ? "bg-brand-600 text-white"
                  : "bg-white text-ink-muted hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <ol className="flex flex-col gap-2">
          {items.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/companies/${c.edinetCode}`}
                className="group flex items-center gap-3 rounded-lg px-1 py-4 transition hover:bg-brand-50/40"
              >
                <RankBadge rank={i + 1} medal={active !== "recent"} />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink group-hover:text-brand-700 sm:text-base">
                  {c.name}
                </p>
                <p className="shrink-0 font-numeric text-sm font-bold tabular-nums text-ink sm:text-base">
                  {c.valueLabel}
                </p>
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-4 text-center">
          <Link
            href={`/search?sort=${active}`}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-blue-700 to-sky-400 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-blue-800 hover:to-sky-500"
          >
            ランキングをもっと見る
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </>
  );
}

function RankBadge({ rank, medal = true }: { rank: number; medal?: boolean }) {
  const tone = !medal
    ? "bg-brand-50 text-brand-700"
    : rank === 1
    ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-white shadow-sm ring-1 ring-amber-600/30"
    : rank === 2
    ? "bg-gradient-to-br from-slate-200 to-slate-400 text-white shadow-sm ring-1 ring-slate-500/30"
    : rank === 3
    ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm ring-1 ring-amber-800/30"
    : "bg-brand-50 text-brand-700";
  return (
    <span
      aria-hidden
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-numeric text-sm font-bold tabular-nums ${tone}`}
    >
      {rank}
    </span>
  );
}
