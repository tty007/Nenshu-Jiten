// ブラウザ専用：CustomEvent でグローバル Toaster コンポーネントに通知を送る軽量 API。
// プロバイダ不要で、どの Client Component からも `toast.success(...)` 等を呼べる。

export type ToastVariant = "success" | "error" | "loading" | "info";

export type ToastDetail = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number; // ms（loading は dismissToast で明示的に消すまで表示）
};

export const TOAST_EVENT = "app:toast";
export const TOAST_DISMISS_EVENT = "app:toast:dismiss";

function makeId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emit(detail: ToastDetail): string {
  if (typeof window === "undefined") return detail.id;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
  return detail.id;
}

export function dismissToast(id: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_DISMISS_EVENT, { detail: { id } }));
}

function show(
  message: string,
  variant: ToastVariant,
  duration?: number
): string {
  return emit({
    id: makeId(),
    variant,
    message,
    duration: duration ?? defaultDuration(variant),
  });
}

function defaultDuration(variant: ToastVariant): number {
  switch (variant) {
    case "loading":
      return 60_000; // 1分（実質ずっと、明示的に dismiss する想定）
    case "error":
      return 5_000;
    default:
      return 2_500;
  }
}

export const toast = {
  success: (m: string, d?: number) => show(m, "success", d),
  error: (m: string, d?: number) => show(m, "error", d),
  info: (m: string, d?: number) => show(m, "info", d),
  loading: (m: string, d?: number) => show(m, "loading", d),
};
