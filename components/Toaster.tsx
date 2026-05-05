"use client";

import { CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  TOAST_DISMISS_EVENT,
  TOAST_EVENT,
  type ToastDetail,
  type ToastVariant,
} from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastDetail[]>([]);

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    function dismiss(id: string) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }

    function onAdd(e: Event) {
      const t = (e as CustomEvent<ToastDetail>).detail;
      setToasts((prev) => {
        // 同じメッセージが連続で来たら後勝ちで置換
        const filtered = prev.filter((p) => p.message !== t.message);
        return [...filtered, t];
      });
      const timer = setTimeout(() => dismiss(t.id), t.duration);
      timers.set(t.id, timer);
    }

    function onDismiss(e: Event) {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      dismiss(id);
    }

    window.addEventListener(TOAST_EVENT, onAdd);
    window.addEventListener(TOAST_DISMISS_EVENT, onDismiss);
    return () => {
      window.removeEventListener(TOAST_EVENT, onAdd);
      window.removeEventListener(TOAST_DISMISS_EVENT, onDismiss);
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end sm:px-0"
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onClose={() => {
            setToasts((prev) => prev.filter((p) => p.id !== t.id));
          }}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastDetail;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        "toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg",
        variantBorder(toast.variant)
      )}
    >
      <span className={cn("mt-0.5 shrink-0", variantTextColor(toast.variant))}>
        {variantIcon(toast.variant)}
      </span>
      <p className="min-w-0 flex-1 leading-snug text-ink">{toast.message}</p>
      {toast.variant !== "loading" && (
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

function variantBorder(v: ToastVariant): string {
  switch (v) {
    case "success":
      return "border-positive/30";
    case "error":
      return "border-negative/30";
    case "loading":
      return "border-brand-100";
    default:
      return "border-surface-border";
  }
}

function variantTextColor(v: ToastVariant): string {
  switch (v) {
    case "success":
      return "text-positive-600";
    case "error":
      return "text-negative-600";
    case "loading":
      return "text-brand-600";
    default:
      return "text-ink-muted";
  }
}

function variantIcon(v: ToastVariant) {
  switch (v) {
    case "success":
      return <CheckCircle2 className="h-4 w-4" aria-hidden />;
    case "error":
      return <XCircle className="h-4 w-4" aria-hidden />;
    case "loading":
      return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;
    default:
      return <Info className="h-4 w-4" aria-hidden />;
  }
}
