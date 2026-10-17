type QueueStore = Pick<Storage, "getItem" | "setItem">;
type DeleteNotification = (id: string) => Promise<unknown>;

const KEY_PREFIX = "worshipflow:error-notification-delete-queue:";

export class ErrorNotificationDeleteQueue {
  private listeners = new Set<() => void>();
  private activeFlushes = new Map<string, Promise<number>>();
  private store: QueueStore;
  private deleteNotification: DeleteNotification;

  constructor(store: QueueStore, deleteNotification: DeleteNotification) {
    this.store = store;
    this.deleteNotification = deleteNotification;
  }

  private key(scope: string) {
    return `${KEY_PREFIX}${encodeURIComponent(scope)}`;
  }

  getPending(scope: string): string[] {
    try {
      const saved = JSON.parse(this.store.getItem(this.key(scope)) ?? "[]") as unknown;
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
    } catch {
      return [];
    }
  }

  private writePending(scope: string, ids: string[]) {
    this.store.setItem(this.key(scope), JSON.stringify(ids));
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  enqueue(scope: string, ids: string[]) {
    const pending = [...new Set([...this.getPending(scope), ...ids.filter(Boolean)])];
    this.writePending(scope, pending);
    return pending;
  }

  flush(scope: string, onDeleted?: (id: string) => void): Promise<number> {
    const active = this.activeFlushes.get(scope);
    if (active) return active;

    const work = (async () => {
      let deleted = 0;
      for (let id = this.getPending(scope)[0]; id; id = this.getPending(scope)[0]) {
        try {
          await this.deleteNotification(id);
        } catch (error) {
          // A previous attempt may have succeeded even if its response was lost.
          if ((error as { status?: number })?.status !== 404) break;
        }
        onDeleted?.(id);
        this.writePending(scope, this.getPending(scope).filter((pendingId) => pendingId !== id));
        deleted += 1;
      }
      return deleted;
    })();

    this.activeFlushes.set(scope, work);
    void work.then(
      () => { this.activeFlushes.delete(scope); },
      () => { this.activeFlushes.delete(scope); },
    );
    return work;
  }
}
