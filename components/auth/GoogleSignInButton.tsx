import { signInWithGoogle } from "@/lib/auth/actions";

type Props = {
  next?: string;
  label?: string;
};

export function GoogleSignInButton({ next, label = "Googleで続ける" }: Props) {
  return (
    <form action={signInWithGoogle}>
      {next && <input type="hidden" name="next" value={next} />}
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-muted"
      >
        <GoogleLogo className="h-5 w-5" />
        {label}
      </button>
    </form>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.7 6.6 29.1 5 24 5 13 5 4 14 4 25s9 20 20 20 20-9 20-20c0-1.5-.2-2.9-.4-4.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.7 6.6 29.1 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5 0 9.6-1.6 13.1-4.5l-6-5c-1.9 1.4-4.4 2.3-7.1 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 40.6 16.2 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6 5C40.6 35 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
