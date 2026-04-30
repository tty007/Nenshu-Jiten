import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  GENDERS,
  CAREER_STATUSES,
  PREFECTURES,
  SALARY_BANDS,
} from "./schemas";

export type UserProfile = {
  nickname: string | null;
  birthYear: number | null;
  gender: (typeof GENDERS)[number] | null;
  prefecture: (typeof PREFECTURES)[number] | null;
  careerStatus: (typeof CAREER_STATUSES)[number] | null;
  salaryBand: (typeof SALARY_BANDS)[number] | null;
};

export const getMyUserProfile = cache(async (): Promise<UserProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("user_profiles")
    .select(
      "nickname, birth_year, gender, prefecture, career_status, salary_band"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    nickname: data.nickname,
    birthYear: data.birth_year,
    gender: data.gender,
    prefecture: data.prefecture,
    careerStatus: data.career_status,
    salaryBand: data.salary_band,
  };
});
