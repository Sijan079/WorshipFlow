// Keeps the screen awake while captions are live, so an idle booth PC does not dim and sleep.
// It cannot stop a person putting the computer to sleep. The browser drops the lock when the tab is
// hidden, so it is taken again when the tab comes back. Anything unsupported or refused is ignored.

type Sentinel = { release: () => Promise<void> };

export type WakeLockEnv = {
  nav: { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
  doc: {
    hidden: boolean;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };
};

export function createWakeLockKeeper({ nav, doc }: WakeLockEnv) {
  let sentinel: Sentinel | null = null;
  let released = false;

  async function acquire() {
    if (released || doc.hidden || !nav.wakeLock || sentinel) return;
    try {
      const next = await nav.wakeLock.request("screen");
      if (released) {
        void next.release().catch(() => undefined);
        return;
      }
      sentinel = next;
    } catch {
      // Not supported here, or the browser said no. The booth works the same without it.
    }
  }

  function onVisibility() {
    if (doc.hidden) return;
    sentinel = null; // the browser already dropped the old lock when the tab was hidden
    void acquire();
  }

  doc.addEventListener("visibilitychange", onVisibility);
  void acquire();

  return {
    release() {
      released = true;
      doc.removeEventListener("visibilitychange", onVisibility);
      const current = sentinel;
      sentinel = null;
      void current?.release().catch(() => undefined);
    },
  };
}
