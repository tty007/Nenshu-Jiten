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
      <Link href="/" className="mb-8 inline-flex items-center">
        <span className="bg-gradient-to-r from-blue-700 to-sky-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          年収辞典
        </span>
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
