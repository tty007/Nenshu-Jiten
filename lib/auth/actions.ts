"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateDisplayNameSchema,
  updateEmailSchema,
  updatePasswordSchema,
} from "./schemas";
import { getCurrentUser } from "./get-user";

export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * 認証メールやOAuthの戻り先URLは、ユーザーが今いる origin を使う。
 * NEXT_PUBLIC_SITE_URL は sitemap/SEO用途のみで、auth ランタイムでは
 * 参照しない（ローカルで signup → 本番URLに誘導される 404 を防ぐ）。
 */
async function getSiteUrl(): Promise<string> {
  return await originFromHeaders();
}

// ----- Sign up (email + password) -----
export async function signUpWithEmail(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const sb = await createSupabaseServerClient();
  const site = await getSiteUrl();
  const { error } = await sb.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      // PKCE フローの確認URL: <site>/auth/confirm?token_hash=...&next=<emailRedirectTo>
      // verifyOtp 後にそのまま /mypage へ。/auth/callback 経由は OAuth 用なので使わない。
      emailRedirectTo: `${site}/mypage`,
    },
  });
  if (error) {
    return { ok: false, error: humanizeAuthError(error.message) };
  }
  redirect("/auth/verify-email");
}

// ----- Sign in (email + password) -----
export async function signInWithEmail(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: humanizeAuthError(error.message) };
  }
  const next = (formData.get("next") as string) || "/mypage";
  revalidatePath("/", "layout");
  redirect(next);
}

// ----- Sign in (Google OAuth) -----
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const sb = await createSupabaseServerClient();
  const site = await getSiteUrl();
  const next = (formData.get("next") as string) || "/mypage";
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    redirect(`/auth/sign-in?error=${encodeURIComponent(error.message)}`);
  }
  redirect(data.url);
}

// ----- Sign out -----
export async function signOut(): Promise<void> {
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// ----- Forgot password -----
export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      error: "メールアドレスを確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const sb = await createSupabaseServerClient();
  const site = await getSiteUrl();
  await sb.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site}/auth/reset-password`,
  });
  // セキュリティ上、メール存在に関わらず常に成功扱い
  return { ok: true, message: "リセット用メールを送信しました（メールが届かない場合、未登録の可能性があります）" };
}

// ----- Reset password (after email link) -----
export async function resetPassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: humanizeAuthError(error.message) };
  }
  redirect("/mypage");
}

// ----- Mypage actions -----
export async function updateDisplayName(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインが必要です" };
  const parsed = updateDisplayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mypage");
  return { ok: true, message: "表示名を更新しました" };
}

export async function updateEmail(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインが必要です" };
  const parsed = updateEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.updateUser({ email: parsed.data.email });
  if (error) return { ok: false, error: humanizeAuthError(error.message) };
  return {
    ok: true,
    message: "確認メールを送信しました。新しいメールアドレスのリンクを開くと反映されます。",
  };
}

export async function updatePassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインが必要です" };
  const parsed = updatePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    newPasswordConfirm: formData.get("newPasswordConfirm"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const sb = await createSupabaseServerClient();
  // 念のため現パスワードで再認証
  if (user.email) {
    const { error: reauthError } = await sb.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    });
    if (reauthError) {
      return { ok: false, error: "現在のパスワードが正しくありません" };
    }
  }
  const { error } = await sb.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { ok: false, error: humanizeAuthError(error.message) };
  return { ok: true, message: "パスワードを更新しました" };
}

export async function deleteAccount(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  const admin = createSupabaseAdminClient();
  await admin.auth.admin.deleteUser(user.id);
  // ローカルセッションも破棄
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}

// ----- helpers -----
function humanizeAuthError(message: string): string {
  // Supabase の代表的エラーメッセージを日本語化
  const map: Record<string, string> = {
    "Invalid login credentials": "メールアドレスまたはパスワードが正しくありません",
    "Email not confirmed": "メールアドレスの確認が完了していません。受信トレイのリンクを開いてください",
    "User already registered": "このメールアドレスは既に登録されています",
    "Email rate limit exceeded": "送信回数の上限に達しました。しばらくしてから再度お試しください",
    "Password should be at least 6 characters.":
      "パスワードは8文字以上で入力してください",
  };
  return map[message] ?? message;
}
