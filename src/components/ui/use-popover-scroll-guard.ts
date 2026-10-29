"use client";

import { useCallback, useRef } from "react";

// A dialog locks page scrolling and ignores anything outside its own content. When a portaled popup is
// short enough on screen that it scrolls, stop wheel and touch at the popup so it still can. The popup
// mounts a render after it opens, so this attaches through a callback ref the moment the element exists.
export function usePopoverScrollGuard() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((node: HTMLDivElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!node) return;
    const keepScrollHere = (event: Event) => event.stopPropagation();
    node.addEventListener("wheel", keepScrollHere, { passive: true });
    node.addEventListener("touchmove", keepScrollHere, { passive: true });
    cleanup.current = () => {
      node.removeEventListener("wheel", keepScrollHere);
      node.removeEventListener("touchmove", keepScrollHere);
    };
  }, []);
}
