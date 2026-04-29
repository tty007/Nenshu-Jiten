import Link from "next/link";

type Props = {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function AuthFormShell({ title, subtitle, footer, children }: Props) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-base font-semibold text-ink"
      >
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white"
        >
          <span className="font-numeric text-sm font-bold tracking-tight">Y</span>
        </span>
        年収辞典
      </Link>
      <div className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
      {footer && (
        <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>
      )}
    </main>
  );
}
