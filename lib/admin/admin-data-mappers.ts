import "server-only";
import type { User as SupabaseUser } from "@supabase/supabase-js";

/**
 * service_role から取得した auth.users 行は app_metadata / aud / phone / 内部用フラグ
 * など多くの情報を含む。Client Component に渡る可能性のあるレイヤでは必ずここを通し、
 * 必要な列だけを絞った型に変換する。
 */
export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  provider: string | null; // "email" | "google" | ...
};

export function mapAdminUser(u: SupabaseUser): AdminUserRow {
  // identities[0]?.provider は最初に紐付いたプロバイダ。app_metadata.providers にも入る。
  const provider: string | null =
    (u.app_metadata?.provider as string | undefined) ??
    (Array.isArray(u.identities)
      ? u.identities[0]?.provider ?? null
      : null);
  return {
    id: u.id,
    email: u.email ?? null,
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    emailConfirmedAt: u.email_confirmed_at ?? null,
    provider,
  };
}
