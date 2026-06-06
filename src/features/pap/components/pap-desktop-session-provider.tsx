"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePAPDesktopSession } from "../hooks/use-pap-desktop-session";

type PAPDesktopSessionContextValue = ReturnType<typeof usePAPDesktopSession>;

const PAPDesktopSessionContext = createContext<PAPDesktopSessionContextValue | null>(null);

export function PAPDesktopSessionProvider({ children }: { children: ReactNode }) {
  const session = usePAPDesktopSession();

  return (
    <PAPDesktopSessionContext.Provider value={session}>
      {children}
    </PAPDesktopSessionContext.Provider>
  );
}

export function usePAPDesktopSessionContext() {
  const session = useContext(PAPDesktopSessionContext);
  if (!session) {
    throw new Error("PAPDesktopClient must be rendered inside PAPDesktopSessionProvider.");
  }

  return session;
}
