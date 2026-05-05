"use client";

import { useState } from "react";
import { Check, Mail, X } from "lucide-react";
import type { AdminUserListItem } from "@/lib/admin/get-admin-users";
import { UserDetailDialog } from "./UserDetailDialog";

type Props = {
  items: AdminUserListItem[];
};

const JST_DATE = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return JST_DATE.format(d);
}

export function UserTable({ items }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border bg-white p-10 text-center text-sm text-ink-muted">
        該当するユーザーがいません
      </div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-surface-border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">email / nickname</th>
              <th className="px-3 py-3 font-medium">登録日</th>
              <th className="px-3 py-3 font-medium">認証</th>
              <th className="px-3 py-3 font-medium">プロフ</th>
              <th className="px-3 py-3 font-medium">最終ログイン</th>
              <th className="px-3 py-3 font-medium">★</th>
              <th className="px-3 py-3 font-medium">provider</th>
              <th className="px-3 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border text-ink">
            {items.map((u) => (
              <tr
                key={u.id}
                onClick={() => setOpenId(u.id)}
                className="cursor-pointer transition hover:bg-brand-50/40"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="break-all font-medium">
                      {u.email ?? "-"}
                    </span>
                    {u.nickname && (
                      <span className="text-xs text-ink-muted">
                        {u.nickname}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 font-numeric tabular-nums text-ink-muted">
                  {fmtDate(u.createdAt)}
                </td>
                <td className="px-3 py-3">
                  {u.emailConfirmedAt ? (
                    <Check
                      className="h-4 w-4 text-positive-600"
                      aria-label="確認済み"
                    />
                  ) : (
                    <Mail
                      className="h-4 w-4 text-amber-600"
                      aria-label="未確認"
                    />
                  )}
                </td>
                <td className="px-3 py-3">
                  {u.profileCompleted ? (
                    <Check
                      className="h-4 w-4 text-positive-600"
                      aria-label="完了"
                    />
                  ) : (
                    <X className="h-4 w-4 text-ink-subtle" aria-label="未完" />
                  )}
                </td>
                <td className="px-3 py-3 font-numeric tabular-nums text-ink-muted">
                  {fmtDate(u.lastSignInAt)}
                </td>
                <td className="px-3 py-3 text-right font-numeric tabular-nums">
                  {u.favoritesCount}
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted">
                  {u.provider ?? "-"}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(u.id);
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                  >
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserDetailDialog
        open={openId !== null}
        userId={openId}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
