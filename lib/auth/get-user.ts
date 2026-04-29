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
  displayName: string | null;
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
    const { data, error } = await sb
      .from("profiles")
      .select("id, email, display_name, created_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      createdAt: data.created_at,
    };
  }
);
