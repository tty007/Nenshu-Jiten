import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
};

export type CurrentProfile = {
  id: string;
  email: string;
  nickname: string | null;
  createdAt: string;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
  };
});

export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    const user = await getCurrentUser();
    if (!user) return null;
    const sb = await createSupabaseServerClient();
    const [profileRes, attrRes] = await Promise.all([
      sb
        .from("profiles")
        .select("id, email, created_at")
        .eq("id", user.id)
        .maybeSingle(),
      sb
        .from("user_profiles")
        .select("nickname")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (profileRes.error || !profileRes.data) return null;
    return {
      id: profileRes.data.id,
      email: profileRes.data.email,
      nickname: attrRes.data?.nickname ?? null,
      createdAt: profileRes.data.created_at,
    };
  }
);
