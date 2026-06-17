"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import { useCallback, useState } from "react";

type PAPToast = {
  id: string;
  message: string;
  tone: "info" | "success";
};

export function usePAPToasts() {
  const [toasts, setToasts] = useState<PAPToast[]>([]);

  const showToast = useCallback((message: string, tone: PAPToast["tone"] = "info") => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((currentToasts) => [{ id, message, tone }, ...currentToasts].slice(0, 4));
    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  return { dismissToast, showToast, toasts };
}

export function PAPToastViewport({
  dismissToast,
  toasts,
}: {
  dismissToast: (id: string) => void;
  toasts: PAPToast[];
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = toast.tone === "success" ? CheckCircle2 : Info;
        return (
          <div
            key={toast.id}
            className="animate-toast-in rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel)] p-3 shadow-[var(--elevation-subtle)]"
          >
            <div className="flex items-start gap-3">
              <Icon className={toast.tone === "success" ? "mt-0.5 h-4 w-4 text-[var(--state-success)]" : "mt-0.5 h-4 w-4 text-[var(--text-accent)]"} />
              <p className="min-w-0 flex-1 text-sm font-semibold leading-5">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="pressable rounded-[var(--radius-control)] p-1 text-[var(--text-muted)]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
