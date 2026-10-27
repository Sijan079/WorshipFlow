"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import type { AudioInputChoice } from "./audio-input-step";
import CaptionLiveButton from "./caption-live-button";
import { extensionWindowOpen } from "./caption-contract";
import { captionIsRunning, captionTitle } from "./caption-ui";
import ExtendPrompt from "./extend-prompt";
import DevDatabaseDialog from "./dev-database-dialog";
import StopConfirmDialog from "./stop-confirm-dialog";
import { useCaptionSession } from "./use-caption-session";
import { useLiveGuards } from "./use-live-guards";

type ToastTone = "info" | "success" | "error";

export type CaptionEngine = ReturnType<typeof useCaptionSession> & {
  input: AudioInputChoice;
  setInput: (input: AudioInputChoice) => void;
  running: boolean;
  showToast: (message: string, tone?: ToastTone) => void;
  requestStart: () => void;
  requestStop: () => void;
};

const NO_INPUT: AudioInputChoice = { id: "", label: "" };
const CaptionEngineContext = createContext<CaptionEngine | null>(null);

export function useCaptionEngine() {
  const engine = useContext(CaptionEngineContext);
  if (!engine) throw new Error("useCaptionEngine needs the CaptionEngineProvider that wraps the workspace.");
  return engine;
}

// For parts of the shell that only need to know whether captions are live.
export function useOptionalCaptionEngine() {
  return useContext(CaptionEngineContext);
}

// The captions session lives here, above every workspace page, so moving around the app does not stop
// it. The Captions page only displays it. This also owns the one toast viewport, the stop question, the
// live-database question, and the floating live button, so every page asks them the same way.
export default function CaptionEngineProvider({ workspaceSlug, children }: { workspaceSlug: string; children: ReactNode }) {
  // The shell's own session query (same key, so no second request): only people who can view captions
  // ask the server about sessions, because a refused request is reported to error notifications.
  const sessionQuery = useQuery({
    queryKey: ["auth", "session", workspaceSlug],
    queryFn: () => apiFetch<{ user?: { canViewCaptions?: boolean } | null }>(`/api/auth/session?workspaceSlug=${encodeURIComponent(workspaceSlug)}`),
  });
  const enabled = Boolean(sessionQuery.data?.user?.canViewCaptions);
  const pathname = usePathname();
  const [input, setInput] = useState<AudioInputChoice>(NO_INPUT);
  const [stopOpen, setStopOpen] = useState(false);
  const [liveDatabaseOpen, setLiveDatabaseOpen] = useState(false);
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const captions = useCaptionSession({ inputId: input.id, inputLabel: input.label, notify: showToast, enabled, onInputRestored: setInput });
  const running = captionIsRunning(captions.state);
  useLiveGuards(running);

  // The tab title says LIVE while captions run, so the operator can see it from another tab.
  useEffect(() => {
    const apply = () => {
      const next = captionTitle(document.title, running);
      if (next !== document.title) document.title = next;
    };
    apply();
    if (!running) return;
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = captionTitle(document.title, false);
    };
  }, [running]);

  // In the last fifteen minutes of the session, offer four more hours once.
  const [clock, setClock] = useState(() => Date.now());
  const [declinedFor, setDeclinedFor] = useState("");
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [running]);
  const expiresAt = captions.session?.expiresAt ?? "";
  const extendOffered = running && expiresAt !== "" && declinedFor !== expiresAt && extensionWindowOpen(new Date(expiresAt), new Date(clock));

  // Start clears a stop question left open by a session that ended on its own. On a development server
  // connected to the live database it asks first, because test captions would reach the real link.
  function requestStart() {
    setStopOpen(false);
    if (captions.devAgainstLiveDatabase) {
      setLiveDatabaseOpen(true);
      return;
    }
    void captions.start();
  }

  const engine: CaptionEngine = {
    ...captions,
    input,
    setInput,
    running,
    showToast,
    requestStart,
    requestStop: () => setStopOpen(true),
  };

  const onCaptionsPage = pathname === `/w/${workspaceSlug}/captions`;

  return (
    <CaptionEngineContext.Provider value={engine}>
      {children}
      {stopOpen && (running || captions.session) ? (
        <StopConfirmDialog
          onConfirm={() => {
            setStopOpen(false);
            void (running ? captions.stop() : captions.stopExisting());
          }}
          onCancel={() => setStopOpen(false)}
        />
      ) : null}
      {liveDatabaseOpen ? (
        <DevDatabaseDialog
          onConfirm={() => {
            setLiveDatabaseOpen(false);
            void captions.start();
          }}
          onCancel={() => setLiveDatabaseOpen(false)}
        />
      ) : null}
      {extendOffered ? (
        <ExtendPrompt
          minutesLeft={Math.max(1, Math.ceil((new Date(expiresAt).getTime() - clock) / 60_000))}
          onExtend={() => void captions.extend()}
          onDismiss={() => setDeclinedFor(expiresAt)}
        />
      ) : null}
      {running && !onCaptionsPage ? (
        <CaptionLiveButton
          state={captions.state}
          inputLabel={input.label}
          captionsHref={`/w/${workspaceSlug}/captions`}
          startedAt={captions.session?.createdAt ?? new Date().toISOString()}
          onStop={() => setStopOpen(true)}
        />
      ) : null}
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </CaptionEngineContext.Provider>
  );
}
