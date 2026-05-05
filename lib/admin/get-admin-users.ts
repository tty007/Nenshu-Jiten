import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapAdminUser, type AdminUserRow } from "./admin-data-mappers";

const PAGE_SIZE = 20;

export type AdminUserListItem = AdminUserRow & {
  nickname: string | null;
  profileCompleted: boolean;
  favoritesCount: number;
};

const PROFILE_REQUIRED_FIELDS = [
  "nickname",
  "birth_year",
  "gender",
  "prefecture",
  "career_status",
  "salary_band",
] as const;

export type ListUsersResult = {
  items: AdminUserListItem[];
  page: number;
  totalPages: number;
  total: number;
};

export async function listAdminUsers(opts: {
  page?: number;
  search?: string;
} = {}): Promise<ListUsersResult> {
  const sb = createSupabaseAdminClient();
  const page = Math.max(1, opts.page ?? 1);

  // listUsers は server side ページング対応。検索は API レベルでは無いので
  // 全件取得してから client side フィルタ + ページング（数千ユーザー想定）。
  const allUsers: AdminUserRow[] = [];
  let cursor = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({
      page: cursor,
      perPage: 1000,
    });
    if (error) throw error;
    for (const u of data.users) allUsers.push(mapAdminUser(u));
    if (data.users.length < 1000) break;
    cursor++;
  }

  // user_profiles + favorites を一括取得して join
  const [{ data: profiles }, { data: favs }] = await Promise.all([
    sb
      .from("user_profiles")
      .select(
        "user_id, nickname, birth_year, gender, prefecture, career_status, salary_band"
      ),
    sb.from("user_favorites").select("user_id"),
  ]);
  const profileByUser = new Map<string, Record<string, unknown>>();
  for (const p of (profiles ?? []) as unknown as Record<string, unknown>[]) {
    profileByUser.set(p.user_id as string, p);
  }
  const favCountByUser = new Map<string, number>();
  for (const f of (favs ?? []) as { user_id: string }[]) {
    favCountByUser.set(f.user_id, (favCountByUser.get(f.user_id) ?? 0) + 1);
  }

  const enriched: AdminUserListItem[] = allUsers.map((u) => {
    const profile = profileByUser.get(u.id);
    const completed = !!profile && PROFILE_REQUIRED_FIELDS.every((f) => profile[f] !== null);
    return {
      ...u,
      nickname: (profile?.nickname as string | null | undefined) ?? null,
      profileCompleted: completed,
      favoritesCount: favCountByUser.get(u.id) ?? 0,
    };
  });

  const search = opts.search?.trim().toLowerCase() ?? "";
  const filtered = search
    ? enriched.filter(
        (u) =>
          (u.email && u.email.toLowerCase().includes(search)) ||
          (u.nickname && u.nickname.toLowerCase().includes(search))
      )
    : enriched;

  // 並び順: 新規登録順（createdAt desc）
  filtered.sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bt - at;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const items = filtered.slice(start, start + PAGE_SIZE);
  return { items, page, totalPages, total };
}

export type AdminUserDetail = AdminUserRow & {
  profile: {
    nickname: string | null;
    birthYear: number | null;
    gender: string | null;
    prefecture: string | null;
    careerStatus: string | null;
    salaryBand: string | null;
    createdAt: string | null;
  } | null;
  favorites: { id: string; edinetCode: string; name: string; addedAt: string }[];
};

export async function getAdminUserDetail(
  userId: string
): Promise<AdminUserDetail | null> {
  const sb = createSupabaseAdminClient();
  const { data: u, error } = await sb.auth.admin.getUserById(userId);
  if (error || !u.user) return null;

  const [{ data: profile }, { data: favs }] = await Promise.all([
    sb
      .from("user_profiles")
      .select(
        "nickname, birth_year, gender, prefecture, career_status, salary_band, created_at"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    sb
      .from("user_favorites")
      .select("created_at, companies!inner(id, edinet_code, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  type FavRow = {
    created_at: string;
    companies: { id: string; edinet_code: string; name: string };
  };
  const favorites = ((favs as unknown as FavRow[]) ?? []).map((f) => ({
    id: f.companies.id,
    edinetCode: f.companies.edinet_code,
    name: f.companies.name,
    addedAt: f.created_at,
  }));
  type ProfileRow = {
    nickname: string | null;
    birth_year: number | null;
    gender: string | null;
    prefecture: string | null;
    career_status: string | null;
    salary_band: string | null;
    created_at: string | null;
  };
  const p = profile as ProfileRow | null;
  return {
    ...mapAdminUser(u.user),
    profile: p
      ? {
          nickname: p.nickname,
          birthYear: p.birth_year,
          gender: p.gender,
          prefecture: p.prefecture,
          careerStatus: p.career_status,
          salaryBand: p.salary_band,
          createdAt: p.created_at,
        }
      : null,
    favorites,
  };
}
