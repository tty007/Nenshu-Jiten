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
      <Link
        href="/auth/sign-in"
        className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        ログイン
      </Link>
    );
  }

  const label = profile?.displayName || user.email || "アカウント";
  const initial = (label.match(/[A-Za-z0-9ぁ-んァ-ヶ一-龯]/)?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/mypage"
        className="group inline-flex items-center gap-2 rounded-full border-surface-border bg-white text-sm text-ink hover:border-brand-100 hover:bg-brand-50/40 sm:border sm:py-1 sm:pl-1 sm:pr-3"
        title={`マイページ (${label})`}
      >
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white sm:h-7 sm:w-7"
        >
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate font-medium sm:inline">
          {label}
        </span>
      </Link>
      <form action={signOut} className="hidden sm:block">
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
