import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/get-user";

export async function UserMenu() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth/sign-in"
          className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:text-ink sm:inline-flex"
        >
          ログイン
        </Link>
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          会員登録
        </Link>
      </div>
    );
  }

  const label = profile?.displayName || user.email || "アカウント";
  const initial = (label.match(/[A-Za-z0-9ぁ-んァ-ヶ一-龯]/)?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/mypage"
        className="group inline-flex items-center gap-2 rounded-full border border-surface-border bg-white py-1 pl-1 pr-3 text-sm text-ink hover:border-brand-100 hover:bg-brand-50/40"
        title={`マイページ (${label})`}
      >
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white"
        >
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate font-medium sm:inline">
          {label}
        </span>
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="ログアウト"
          title="ログアウト"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
