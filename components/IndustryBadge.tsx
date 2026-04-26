import { cn } from "@/lib/utils";

export function IndustryBadge({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  if (!name) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-base font-medium text-brand-600",
        className
      )}
    >
      {name}
    </span>
  );
}

export function MarketBadge({
  market,
  className,
}: {
  market: string | null | undefined;
  className?: string;
}) {
  if (!market) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-surface-border bg-white px-2.5 py-0.5 text-base font-medium text-ink-muted",
        className
      )}
    >
      {market}
    </span>
  );
}
