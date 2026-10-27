// "Duplicate Tab" copies a tab's session storage, so two tabs could both reconnect to the same session
// and publish every line twice. The Web Locks API lets only one tab of this browser hold a session's
// stream. Where it is missing there is no guard, and nothing breaks.

export type LockManagerLike = {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: { name: string } | null) => Promise<void> | void,
  ) => Promise<unknown>;
};

function browserLocks(): LockManagerLike | undefined {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return undefined;
  return navigator.locks as unknown as LockManagerLike;
}

// Resolves with a holder whose release() lets go, or null when another tab already holds the stream.
export function claimStreamLock(sessionId: string, locks: LockManagerLike | undefined = browserLocks()): Promise<{ release: () => void } | null> {
  if (!locks) return Promise.resolve({ release() {} });
  return new Promise((resolve) => {
    void locks.request(`caption-stream-${sessionId}`, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(null);
        return;
      }
      // The lock is held until this promise settles, which is when release() is called.
      return new Promise<void>((hold) => resolve({ release: () => hold() }));
    });
  });
}
