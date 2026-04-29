import Link from "next/link";
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
          className="rounded-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
        >
          ログイン
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          会員登録
        </Link>
      </div>
    );
  }
  const label = profile?.displayName || user.email || "アカウント";
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <Link
        href="/mypage"
        className="max-w-[10rem] truncate rounded-md px-2 py-1 text-ink hover:bg-surface-muted"
        title={label}
      >
        {label}
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md px-2 py-1 text-ink-muted hover:text-ink"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}
