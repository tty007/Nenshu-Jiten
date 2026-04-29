import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * service_role キーを使った管理用クライアント。
 * RLS をバイパスするため、必ず server-only で利用すること。
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}
