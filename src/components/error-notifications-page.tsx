"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { AlertTriangle, FileWarning, Trash2, X } from "lucide-react";
import { apiFetch, fetchErrorNotifications, type ErrorNotificationRecord } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { notificationDeleteScope, useErrorNotificationDeleteQueue } from "@/features/error-notifications/use-delete-queue";
import { SkeletonRows } from "@/components/ui/skeleton";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ErrorNotificationsPage() {
  const pathname = usePathname();
  const workspaceSlug = pathname.match(/^\/w\/([^/]+)/)?.[1];
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const sessionQuery = useQuery({
    queryKey: ["auth", "session", workspaceSlug],
    queryFn: () => apiFetch<{ user: { id: string } | null }>(`/api/auth/session${workspaceSlug ? `?workspaceSlug=${encodeURIComponent(workspaceSlug)}` : ""}`),
  });
  const scope = notificationDeleteScope(workspaceSlug, sessionQuery.data?.user?.id);
  const { pendingIds, enqueue } = useErrorNotificationDeleteQueue(scope);
  const notificationsQuery = useQuery({ queryKey: ["error-notifications"], queryFn: fetchErrorNotifications });
  const pendingSet = new Set(pendingIds);
  const notifications = (notificationsQuery.data ?? []).filter((item) => !pendingSet.has(item.id));

  function queueDeletes(ids: string[]) {
    setQueueError(null);
    if (enqueue(ids)) return true;
    setQueueError("Could not queue the deletion. Please try again.");
    return false;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileWarning className="mt-0.5 h-5 w-5 text-[var(--text-accent)]" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Error notifications</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Errors saved for this workspace. Sending a report clears the related item.</p>
          </div>
        </div>
        {notifications.length > 0 ? <button type="button" onClick={() => setConfirmClearAll(true)} disabled={!scope} className="ui-btn-secondary pressable inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" />Clear all</button> : null}
      </div>

      {queueError ? <p role="alert" className="text-sm text-[var(--text-danger)]">{queueError}</p> : null}
      {notificationsQuery.isPending ? <div className="ui-surface-panel overflow-hidden"><SkeletonRows label="Loading error notifications" rows={4} /></div> : notificationsQuery.error ? <div className="ui-surface-panel flex items-center justify-between gap-3 p-6 text-sm text-[var(--text-danger)]" role="alert"><span>Could not load error notifications.</span><button type="button" onClick={() => void notificationsQuery.refetch()} className="ui-btn-secondary px-3 py-2 text-sm font-semibold">Retry</button></div> : notifications.length === 0 ? (
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
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => queueDeletes([notification.id])} disabled={!scope} className="ui-btn-secondary pressable inline-flex h-10 items-center gap-1.5 px-3 text-sm font-semibold disabled:opacity-50" aria-label={`Clear notification: ${notification.message}`}><X className="h-4 w-4" aria-hidden="true" />Clear</button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent<ErrorNotificationRecord>("worshipflow:report-error", { detail: notification }))}
                  className="ui-btn-primary pressable shrink-0 px-3 text-sm font-semibold disabled:opacity-50"
                >
                  Report issue
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <DialogContent className="ui-modal max-w-md p-5">
          <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Clear All Error Notifications?</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">This queues the {notifications.length} visible error notifications for deletion. They disappear now and finish clearing in the background.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmClearAll(false)} className="ui-btn-cancel pressable h-10 px-3 text-sm font-semibold">Cancel</button>
            <button type="button" onClick={() => { if (queueDeletes(notifications.map((item) => item.id))) setConfirmClearAll(false); }} disabled={!scope} className="ui-btn-danger pressable h-10 px-3 text-sm font-semibold disabled:opacity-50">Clear all</button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
