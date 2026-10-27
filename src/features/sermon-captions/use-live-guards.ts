"use client";

import { useEffect } from "react";
import { createWakeLockKeeper } from "./wake-lock";

// While captions are live: the browser asks before the tab is closed or reloaded (it shows its own
// wording), and the screen is kept awake. Both end as soon as captions stop.
export function useLiveGuards(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    const keeper = createWakeLockKeeper({ nav: navigator as unknown as Parameters<typeof createWakeLockKeeper>[0]["nav"], doc: document });
    return () => {
      window.removeEventListener("beforeunload", warn);
      keeper.release();
    };
  }, [active]);
}
