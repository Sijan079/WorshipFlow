"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { draftStorageKey, readDraft, writeDraft, type RecoverableDraft } from "./recovery";

type Session = { authenticated: boolean; user: { id: string; role: string | null } | null };

export function useDraftRecovery({ enabled, workspaceSlug, draft, onRestore }: {
  enabled: boolean; workspaceSlug?: string; draft: RecoverableDraft;
  onRestore: (draft: RecoverableDraft) => void;
}) {
  const session = useQuery({
    queryKey: ["auth", "session", workspaceSlug],
    queryFn: () => apiFetch<Session>(`/api/auth/session?workspaceSlug=${encodeURIComponent(workspaceSlug ?? "")}`),
    enabled: enabled && Boolean(workspaceSlug),
  });
  const key = enabled && workspaceSlug && session.data?.authenticated && session.data.user?.role
    ? draftStorageKey(session.data.user.id, workspaceSlug) : null;
  const loadedKey = useRef<string | null>(null);
  const restoringText = useRef<string | null>(null);
  const [status, setStatus] = useState("Checking draft recovery…");
  const draftSignature = JSON.stringify(draft);
  const [savedVersion, setSavedVersion] = useState<{ key: string; signature: string } | null>(null);
  const restore = useEffectEvent(() => {
    if (!key) return;
    const changedScope = loadedKey.current !== null && loadedKey.current !== key;
    try {
      const saved = readDraft(window.localStorage, key);
      if ((saved && !draft.text) || changedScope) {
        const restored = saved ?? { text: "", songTitle: "", warningCodes: [], warningsDismissed: false, directAiReformatUsed: false };
        restoringText.current = restored.text;
        onRestore(restored);
        setStatus("Draft recovered on this device");
      }
      loadedKey.current = key;
    } catch {
      if (changedScope) onRestore({ text: "", songTitle: "", warningCodes: [], warningsDismissed: false, directAiReformatUsed: false });
      setStatus("Device storage unavailable — export to keep your work");
    }
  });
  useEffect(() => {
    if (key !== loadedKey.current) restore();
  }, [key]);

  const persist = useEffectEvent(() => {
    if (!key || loadedKey.current !== key) return;
    if (restoringText.current !== null && draft.text !== restoringText.current) return;
    restoringText.current = null;
    try {
      writeDraft(window.localStorage, key, draft);
      setSavedVersion({ key, signature: draftSignature });
      setStatus(draft.text ? "Saved on this device" : "No saved draft");
    } catch { setStatus("Draft not saved on this device — export to keep your work"); }
  });
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) persist(); });
    return () => { cancelled = true; };
  }, [key, draftSignature]);

  const flush = useEffectEvent(() => {
    if (!key || loadedKey.current !== key || restoringText.current !== null) return;
    try { writeDraft(window.localStorage, key, draft); } catch { /* Status is reported by the save effect. */ }
  });
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  return {
    status: !key && enabled && !session.isPending ? "Device recovery unavailable for this session"
      : status === "Saved on this device" && (savedVersion?.key !== key || savedVersion.signature !== draftSignature)
        ? "Saving changes…" : status,
    checking: enabled && Boolean(workspaceSlug) && session.isPending,
    clear: () => {
      if (!key) return;
      restoringText.current = null;
      try { window.localStorage.removeItem(key); } catch { setStatus("Could not remove the saved draft from this device"); }
    },
  };
}
