import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Page view tracking endpoint.
 *
 * - Client (PageViewTracker) calls this on every route change.
 * - JST 日付 + 正規化パスで page_views テーブルに upsert + count++。
 * - 同一オリジン (Origin/Referer ヘッダ) からのみ受け付ける（ボット汚染対策）。
 * - calc & write は サーバ側で実行 → admin/mypage/auth 等は記録しない。
 */
const EXCLUDED_PREFIXES = [
  "/api/",
  "/admin",
  "/mypage",
  "/auth",
  "/_next",
  "/robots",
  "/sitemap",
];

const ALLOWED_PATH_RE = /^\/[a-zA-Z0-9/_\-.[\]぀-ヿ一-龯]{0,200}$/;

function normalizePath(raw: string): string | null {
  if (!raw) return null;
  // remove query / hash
  const idx = raw.search(/[?#]/);
  let path = idx >= 0 ? raw.slice(0, idx) : raw;
  if (!path.startsWith("/")) return null;
  if (path.length > 200) return null;
  if (!ALLOWED_PATH_RE.test(path)) return null;
  for (const ex of EXCLUDED_PREFIXES) {
    if (path === ex || path.startsWith(ex)) return null;
  }
  // 動的パスのマスク（カウントを集約）
  // /companies/E12345 → /companies/[edinetCode]
  path = path.replace(/^\/companies\/E\d{3,5}\b.*/, "/companies/[edinetCode]");
  // 末尾スラッシュは取り除いて統一
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

function todayJst(): string {
  // YYYY-MM-DD in Asia/Tokyo
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return false;
  const candidates = [origin, referer].filter(Boolean) as string[];
  if (candidates.length === 0) return false;
  for (const c of candidates) {
    try {
      const u = new URL(c);
      if (u.host === host) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * referrer URL を集計用のホスト名に正規化する。
 * - 自サイト経由 → "(internal)"
 * - 空 / null → "(direct)"
 * - URL 解析失敗 → null（集計しない）
 * - それ以外 → "google.com" のようなホスト名（www. は剥がす、長さ制限 100）
 */
function normalizeReferrerHost(
  referrer: string | null | undefined,
  selfHost: string | null,
): string | null {
  if (!referrer) return "(direct)";
  let u: URL;
  try {
    u = new URL(referrer);
  } catch {
    return null;
  }
  let host = u.host.toLowerCase();
  if (selfHost && host === selfHost) return "(internal)";
  host = host.replace(/^www\./, "");
  if (host.length === 0 || host.length > 100) return null;
  return host;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  let body: { path?: string; referrer?: string };
  try {
    body = (await request.json()) as { path?: string; referrer?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const normalized = normalizePath(body.path ?? "");
  if (!normalized) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const sb = createSupabaseAdminClient();
  const date = todayJst();
  const { data: existing } = await sb
    .from("page_views")
    .select("count")
    .eq("date", date)
    .eq("path", normalized)
    .maybeSingle<{ count: number }>();
  const next = (existing?.count ?? 0) + 1;
  const { error } = await sb
    .from("page_views")
    .upsert(
      { date, path: normalized, count: next },
      { onConflict: "date,path" }
    );
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // 参照元集計（page_view_referrers）。失敗しても page_views の成功は返す。
  const referrerHost = normalizeReferrerHost(
    body.referrer,
    request.headers.get("host"),
  );
  if (referrerHost) {
    const { data: existingRef } = await sb
      .from("page_view_referrers")
      .select("count")
      .eq("date", date)
      .eq("path", normalized)
      .eq("referrer_host", referrerHost)
      .maybeSingle<{ count: number }>();
    const nextRef = (existingRef?.count ?? 0) + 1;
    await sb
      .from("page_view_referrers")
      .upsert(
        { date, path: normalized, referrer_host: referrerHost, count: nextRef },
        { onConflict: "date,path,referrer_host" },
      );
  }

  return NextResponse.json({ ok: true });
}
