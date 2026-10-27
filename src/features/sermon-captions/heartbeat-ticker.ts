// A repeating timer that keeps ticking when the page is in the background. A hidden tab slows its own
// timers (down to about one a minute), which would make the public page show "interrupted" while the
// booth is fine. A worker's timer is not slowed that way. Where workers are unavailable, or the page is
// not allowed to create one, it falls back to a plain timer.

export type TickerEnv = {
  Worker?: typeof Worker;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  setInterval?: (callback: () => void, ms: number) => number;
  clearInterval?: (id: number) => void;
};

function browserEnv(): TickerEnv {
  return {
    Worker: typeof Worker === "undefined" ? undefined : Worker,
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    setInterval: (callback, ms) => globalThis.setInterval(callback, ms) as unknown as number,
    clearInterval: (id) => globalThis.clearInterval(id),
  };
}

export function createTicker(intervalMs: number, onTick: () => void, env: TickerEnv = browserEnv()): { stop: () => void; usingWorker: boolean } {
  let stopped = false;
  const tick = () => { if (!stopped) onTick(); };

  if (env.Worker && env.createObjectURL && env.revokeObjectURL) {
    const revoke = env.revokeObjectURL;
    let url = "";
    try {
      url = env.createObjectURL(new Blob([
        `const id = setInterval(() => postMessage(1), ${Math.max(100, Math.round(intervalMs))});`
        + ` onmessage = (event) => { if (event.data === "stop") { clearInterval(id); close(); } };`,
      ], { type: "text/javascript" }));
      const worker = new env.Worker(url);
      worker.onmessage = tick;
      return {
        usingWorker: true,
        stop() {
          if (stopped) return;
          stopped = true;
          worker.postMessage("stop");
          worker.terminate();
          revoke(url);
        },
      };
    } catch {
      if (url) revoke(url);
    }
  }

  const set = env.setInterval ?? browserEnv().setInterval!;
  const clear = env.clearInterval ?? browserEnv().clearInterval!;
  const id = set(tick, intervalMs);
  return {
    usingWorker: false,
    stop() {
      if (stopped) return;
      stopped = true;
      clear(id);
    },
  };
}
