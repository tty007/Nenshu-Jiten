"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

type Props = {
  defaultValue?: string;
  size?: "sm" | "lg";
  className?: string;
};

export function SearchBox({ defaultValue = "", size = "lg", className }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const isLarge = size === "lg";
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "relative flex items-center w-full",
        isLarge ? "max-w-2xl" : "max-w-md",
        className
      )}
      role="search"
    >
      <Search
        className={cn(
          "absolute left-4 text-ink-subtle",
          isLarge ? "h-5 w-5" : "h-4 w-4"
        )}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="企業名・証券コードで検索"
        aria-label="企業を検索"
        className={cn(
          "w-full rounded-full border border-surface-border bg-white pl-12 pr-28 outline-none transition",
          "focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
          isLarge ? "h-14 text-base" : "h-10 text-sm"
        )}
      />
      <button
        type="submit"
        className={cn(
          "absolute right-2 rounded-full bg-brand px-5 font-medium text-white transition hover:bg-brand-700",
          isLarge ? "h-11 text-sm" : "h-7 px-3 text-base"
        )}
      >
        検索
      </button>
    </form>
  );
}
