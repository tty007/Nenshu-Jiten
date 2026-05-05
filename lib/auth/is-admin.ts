import "server-only";
import { cache } from "react";
import { getCurrentUser } from "./get-user";

/**
 * 管理者権限の判定。env (`ADMIN_EMAILS`) ベースで運用する。
 * - DB テーブルを介さないため、Vercel UI で即時にメンテ可能
 * - email は trim + lowercase の正規化を施して比較する
 *   （Supabase Auth は email を lowercase 保存しているが、防御的に）
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  if (!target) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(target);
}

/**
 * 現在ログイン中のユーザーが管理者か。
 * Server Component や Server Action から呼ぶ前提（getCurrentUser に依存）。
 */
export const isCurrentUserAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
});
