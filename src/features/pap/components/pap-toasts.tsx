"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";

type PAPToast = {
  id: string;
  message: string;
  tone: "info" | "success" | "error";
  action?: { label: string; onClick: () => void };
};

type ToastOptions = {
  action?: PAPToast["action"];
  durationMs?: number | null;
};

export function usePAPToasts() {
  const [toasts, setToasts] = useState<PAPToast[]>([]);

  const showToast = useCallback((message: string, tone: PAPToast["tone"] = "info", options: ToastOptions = {}) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((currentToasts) => [{ id, message, tone, action: options.action }, ...currentToasts].slice(0, 4));
    const durationMs = options.durationMs === undefined ? (tone === "error" ? 5200 : 2600) : options.durationMs;
    if (durationMs !== null) {
      window.setTimeout(() => {
        setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
      }, durationMs);
    }
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
  return (
    <div className="workspace-content-light fixed right-4 top-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 text-[var(--text-primary)]">
      <AnimatePresence initial={false} mode="popLayout">
      {toasts.map((toast) => {
        const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? CircleAlert : Info;
        const toneClass = toast.tone === "success"
          ? "border-[color-mix(in_oklab,var(--state-success)_32%,var(--border-default))] bg-[var(--state-success-soft)]"
          : toast.tone === "error"
            ? "border-[color-mix(in_oklab,var(--state-danger)_32%,var(--border-default))] bg-[var(--state-danger-soft)]"
            : "border-[var(--border-default)] bg-[var(--surface-panel)]";
        const iconClass = toast.tone === "success"
          ? "text-[var(--state-success)]"
          : toast.tone === "error"
            ? "text-[var(--state-danger)]"
            : "text-[var(--text-accent)]";
        return (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 12 }}
            role={toast.tone === "error" ? "alert" : "status"}
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
            className={`rounded-[var(--radius-control)] border p-3 shadow-[var(--elevation-subtle)] ${toneClass}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
              <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--text-primary)]">{toast.message}</p>
              {toast.action ? (
                <button type="button" onClick={toast.action.onClick} className="pressable shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[color-mix(in_oklab,currentColor_10%,transparent)]">
                  {toast.action.label}
                </button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => dismissToast(toast.id)}
                className="pressable text-[var(--text-muted)]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        );
      })}
      </AnimatePresence>
    </div>
  );
}
