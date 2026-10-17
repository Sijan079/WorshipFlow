"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { removeErrorNotification, type ErrorNotificationRecord } from "@/lib/api-client";
import { ErrorNotificationDeleteQueue } from "@/lib/error-notification-delete-queue";

let browserQueue: ErrorNotificationDeleteQueue | null = null;

function getBrowserQueue() {
  if (typeof window === "undefined") return null;
  try {
    browserQueue ??= new ErrorNotificationDeleteQueue(window.localStorage, removeErrorNotification);
    return browserQueue;
  } catch {
    return null;
  }
}

export function notificationDeleteScope(workspaceSlug: string | undefined, userId: string | undefined) {
  return userId ? `${workspaceSlug ?? "default"}:${userId}` : null;
}

export function useErrorNotificationDeleteQueue(scope: string | null) {
  const queryClient = useQueryClient();
  const queue = getBrowserQueue();
  const pendingSnapshot = useSyncExternalStore(
    (notify) => {
      const unsubscribe = queue?.subscribe(notify);
      window.addEventListener("storage", notify);
      return () => { unsubscribe?.(); window.removeEventListener("storage", notify); };
    },
    () => scope && queue ? queue.getPending(scope).join("\u0000") : "",
    () => "",
  );
  const pendingIds = pendingSnapshot ? pendingSnapshot.split("\u0000") : [];

  const flush = useCallback(() => {
    if (!scope || !queue) return;
    void queue.flush(scope, (id) => {
      queryClient.setQueryData<ErrorNotificationRecord[]>(["error-notifications"], (current) => current?.filter((item) => item.id !== id));
    }).then((deleted) => {
      if (deleted > 0) void queryClient.invalidateQueries({ queryKey: ["error-notifications"] });
    }).catch(() => undefined);
  }, [queue, queryClient, scope]);

  useEffect(() => {
    if (!scope || !queue) return;
    flush();
    window.addEventListener("online", flush);
    window.addEventListener("focus", flush);
    const retryTimer = window.setInterval(flush, 30_000);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener("focus", flush);
      window.clearInterval(retryTimer);
    };
  }, [scope, queue, flush]);

  const enqueue = useCallback((ids: string[]) => {
    if (!scope || !queue) return false;
    try {
      queue.enqueue(scope, ids);
      const queuedIds = new Set(ids);
      queryClient.setQueryData<ErrorNotificationRecord[]>(["error-notifications"], (current) => current?.filter((item) => !queuedIds.has(item.id)));
      flush();
      return true;
    } catch {
      return false;
    }
  }, [scope, queue, queryClient, flush]);

  return { pendingIds, enqueue };
}
