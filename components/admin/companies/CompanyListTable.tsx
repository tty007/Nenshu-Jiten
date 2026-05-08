"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { AdminCompanyRow } from "@/lib/admin/get-admin-companies";
import { CompanyDetailDialog } from "./CompanyDetailDialog";

type Props = {
  rows: AdminCompanyRow[];
};

function fmtSalary(n: number | null): string {
  if (n == null) return "-";
  return `${Math.round(n / 10000).toLocaleString("ja-JP")} 万円`;
}

export function CompanyListTable({ rows }: Props) {
  const [selected, setSelected] = useState<AdminCompanyRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="border-y border-surface-border py-10 text-center text-sm text-ink-muted">
        該当企業がありません
      </div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-y border-surface-border text-sm">
          <thead className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-medium">企業</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">EDINET</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">証券コード</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">業界</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">最新年度</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">最新平均年収</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border text-ink">
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="cursor-pointer transition hover:bg-brand-50/30"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.name}</span>
                    {r.name_kana && (
                      <span className="text-xs text-ink-subtle">{r.name_kana}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-ink-muted">
                  {r.edinet_code}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-ink-muted">
                  {r.securities_code ?? "-"}
                </td>
                <td className="px-3 py-3 text-ink-muted">{r.industry_name ?? "-"}</td>
                <td className="px-3 py-3 font-numeric tabular-nums text-ink-muted">
                  {r.latest_fiscal_year ?? "-"}
                </td>
                <td className="px-3 py-3 text-right font-numeric tabular-nums">
                  {fmtSalary(r.latest_average_annual_salary)}
                </td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/companies/${r.edinet_code}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded p-1 text-brand-600 hover:bg-brand-50"
                    title="公開ページを新規タブで開く"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CompanyDetailDialog
        open={selected !== null}
        company={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
