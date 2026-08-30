"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileWarning } from "lucide-react";
import { fetchErrorNotifications, type ErrorNotificationRecord } from "@/lib/api-client";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ErrorNotificationsPage() {
  const notificationsQuery = useQuery({ queryKey: ["error-notifications"], queryFn: fetchErrorNotifications });
  const notifications = notificationsQuery.data ?? [];

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        <FileWarning className="mt-0.5 h-5 w-5 text-[var(--text-accent)]" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Error notifications</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Errors saved for this workspace. Sending a report clears the related item.</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="ui-surface-panel flex min-h-48 flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">No unresolved errors</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">New errors will appear here if you miss their toast.</p>
        </div>
      ) : (
        <div className="ui-surface-panel divide-y divide-[var(--rule-default)] overflow-hidden">
          {notifications.map((notification) => (
            <div key={notification.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{notification.message}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{notification.page} · {formatWhen(notification.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent<ErrorNotificationRecord>("worshipflow:report-error", { detail: notification }))}
                className="ui-btn-primary pressable shrink-0 px-3 text-sm font-semibold"
              >
                Report issue
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
