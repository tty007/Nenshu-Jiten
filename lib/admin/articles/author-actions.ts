"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";

export type AuthorActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  return { ok: true };
}

export type AuthorInput = {
  slug?: string;
  name: string;
  name_kana?: string | null;
  title?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  display_order?: number;
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function normalizeSlug(input: string | undefined, fallbackName: string): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (raw && SLUG_PATTERN.test(raw)) return raw;
  // 名前から英数字以外を除去 → 連続を 1 ハイフンに
  const fromName = fallbackName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return fromName || `author-${Date.now().toString(36)}`;
}

export async function createAuthor(
  input: AuthorInput
): Promise<AuthorActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.name?.trim())
    return { ok: false, error: "著者名は必須です" };

  const sb = createSupabaseAdminClient();
  const slug = normalizeSlug(input.slug, input.name);

  const ins = await sb
    .from("article_authors")
    .insert({
      slug,
      name: input.name.trim(),
      name_kana: input.name_kana?.trim() || null,
      title: input.title?.trim() || null,
      bio: input.bio?.trim() || null,
      avatar_url: input.avatar_url?.trim() || null,
      is_active: input.is_active ?? true,
      display_order: input.display_order ?? 0,
    })
    .select("id")
    .single();
  if (ins.error) return { ok: false, error: ins.error.message };

  revalidatePath("/admin/articles/authors");
  return { ok: true, data: { id: ins.data.id as string } };
}

export async function updateAuthor(
  id: string,
  patch: AuthorInput
): Promise<AuthorActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const sb = createSupabaseAdminClient();
  const updates: Record<string, unknown> = {};
  if (patch.slug !== undefined)
    updates.slug = normalizeSlug(patch.slug, patch.name ?? "");
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.name_kana !== undefined)
    updates.name_kana = patch.name_kana?.trim() || null;
  if (patch.title !== undefined)
    updates.title = patch.title?.trim() || null;
  if (patch.bio !== undefined) updates.bio = patch.bio?.trim() || null;
  if (patch.avatar_url !== undefined)
    updates.avatar_url = patch.avatar_url?.trim() || null;
  if (patch.is_active !== undefined) updates.is_active = patch.is_active;
  if (patch.display_order !== undefined)
    updates.display_order = patch.display_order;

  if (Object.keys(updates).length === 0) return { ok: true };

  const upd = await sb
    .from("article_authors")
    .update(updates)
    .eq("id", id);
  if (upd.error) return { ok: false, error: upd.error.message };

  revalidatePath("/admin/articles/authors");
  revalidatePath("/admin/articles");
  return { ok: true };
}

export async function deleteAuthor(id: string): Promise<AuthorActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();
  // articles.author_id は ON DELETE SET NULL なので参照記事は残る
  const del = await sb.from("article_authors").delete().eq("id", id);
  if (del.error) return { ok: false, error: del.error.message };
  revalidatePath("/admin/articles/authors");
  return { ok: true };
}

/** 記事に著者を割り当て（または解除：authorId = null） */
export async function setArticleAuthor(
  articleId: string,
  authorId: string | null
): Promise<AuthorActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();
  const upd = await sb
    .from("articles")
    .update({ author_id: authorId })
    .eq("id", articleId);
  if (upd.error) return { ok: false, error: upd.error.message };
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

// =====================================================================
// アバター画像アップロード
// =====================================================================

const AVATAR_BUCKET = "author-avatars";
const AVATAR_MIME_ALLOW = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB（バケットの上限と一致）

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

/**
 * FormData 経由で画像を受け取り、author-avatars バケットへ保存して
 * 公開 URL を返す。Author レコードへの URL 保存は呼び出し側（フォーム保存時）で行う。
 */
export async function uploadAuthorAvatar(
  formData: FormData
): Promise<AuthorActionResult<{ url: string; path: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const file = formData.get("file");
  if (!(file instanceof File))
    return { ok: false, error: "ファイルが選択されていません" };
  if (file.size === 0)
    return { ok: false, error: "空のファイルです" };
  if (file.size > AVATAR_MAX_BYTES)
    return {
      ok: false,
      error: `ファイルサイズが上限（${(AVATAR_MAX_BYTES / 1024 / 1024).toFixed(0)} MB）を超えています`,
    };
  if (!AVATAR_MIME_ALLOW.has(file.type))
    return {
      ok: false,
      error: `対応していない形式です（jpeg / png / webp / gif）: ${file.type || "unknown"}`,
    };

  const sb = createSupabaseAdminClient();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `authors/${ts}-${rand}.${extFromMime(file.type)}`;

  const buf = new Uint8Array(await file.arrayBuffer());
  const up = await sb.storage.from(AVATAR_BUCKET).upload(path, buf, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (up.error) return { ok: false, error: up.error.message };

  const pub = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { ok: true, data: { url: pub.data.publicUrl, path } };
}
