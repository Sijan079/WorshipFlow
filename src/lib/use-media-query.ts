"use client";

import { useSyncExternalStore } from "react";

// True while the screen matches the query. The server and the first render answer false, so a layout that
// depends on it should only be drawn after data has loaded.
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
