"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { DraftContentSchema, type DraftContent, type DraftResponse, type ServerDraft } from "./draft-contract";
import { CONNECTION_GRACE_MS, DRAFT_TTL_MS, HEARTBEAT_MS } from "./draft-lifecycle";
import { draftStorageKey, readDraft } from "./recovery";

type Session = { authenticated: boolean; user: { id: string; role: string | null } | null };
const empty: DraftContent = { text: "", songTitle: "", warningCodes: [], warningsDismissed: false, directAiReformatUsed: false };
type Buffer = { conversionId: string; revision: number; content: DraftContent; deadline: number };

export function useServerDraft({ enabled, editing, workspaceSlug, draft, onRestore }: {
  enabled: boolean; editing: boolean; workspaceSlug?: string; draft: DraftContent; onRestore: (draft: DraftContent) => void;
}) {
  const session = useQuery({ queryKey: ["auth", "session", workspaceSlug], queryFn: () => apiFetch<Session>(`/api/auth/session?workspaceSlug=${encodeURIComponent(workspaceSlug ?? "")}`), enabled: enabled && !!workspaceSlug });
  const user = session.data?.user;
  const scope = enabled && workspaceSlug && session.data?.authenticated && user?.role ? `${workspaceSlug}:${user.id}` : null;
  const url = `/api/workspaces/${encodeURIComponent(workspaceSlug ?? "")}/song-formatter/draft`;
  const key = scope ? `worship-flow:song-draft:v2:${scope}` : null;
  const legacyKey = scope && user ? draftStorageKey(user.id, workspaceSlug!) : null;
  const [response, setResponse] = useState<DraftResponse | null>(null);
  const [status, setStatus] = useState("Checking draft recovery…");
  const [owned, setOwned] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<DraftContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [savedSignature, setSavedSignature] = useState("");
  const serverOffset = useRef(0);
  const current = useRef<ServerDraft | null>(null);
  const sessionId = useRef("");
  const generation = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saved = useRef("");
  const restoring = useRef<string | null>(null);
  const latest = useRef(draft);
  const owns = useRef(false);
  const signature = JSON.stringify(draft);
  const restore = (value: DraftContent) => {
    restoring.current = JSON.stringify(value); latest.current = value; onRestore(value);
  };
  useEffect(() => { latest.current = draft; if (restoring.current === signature) restoring.current = null; }, [draft, signature]);
  const accept = (value: DraftResponse) => {
    serverOffset.current = Date.parse(value.serverNow) - Date.now();
    setNow(Date.parse(value.serverNow));
    current.current = value.draft; setResponse(value);
    owns.current = !!value.draft && value.draft.sessionId === sessionId.current;
    setOwned(owns.current);
  };
  const removeBuffer = () => { try { if (key) localStorage.removeItem(key); } catch { /* No server content is retained here. */ } };
  const buffer = () => {
    if (!key || !current.current || !owns.current) return;
    try {
      localStorage.setItem(key, JSON.stringify({ conversionId: current.current.conversionId, revision: current.current.revision,
        content: latest.current, deadline: Date.now() + CONNECTION_GRACE_MS + DRAFT_TTL_MS } satisfies Buffer));
    } catch { /* Server acknowledgement remains authoritative. */ }
  };
  const send = async (body: object, keepalive = false): Promise<DraftResponse> => {
    const ticket = generation.current;
    const encoded = JSON.stringify(body);
    const result = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: encoded, keepalive: keepalive && encoded.length < 60_000 });
    const value = await result.json();
    if (!result.ok) {
      if (ticket === generation.current && (result.status === 409 || result.status === 410 || result.status === 403 || result.status === 401)) {
        owns.current = false; setOwned(false);
        if (result.status === 410 || result.status === 403 || result.status === 401) {
          current.current = null; setResponse(null); removeBuffer(); restore(empty);
        }
      }
      throw new Error(value.error || "Draft could not be saved.");
    }
    return value;
  };
  const enqueue = <T,>(operation: () => Promise<T>) => {
    const task = queue.current.catch(() => undefined).then(operation);
    queue.current = task;
    return task;
  };
  const save = (keepalive = false) => {
    const ticket = generation.current;
    return enqueue(async () => {
    if (ticket !== generation.current) return;
    const active = current.current;
    if (!active || !owns.current || restoring.current !== null) return;
    const content = latest.current;
    const nextSignature = JSON.stringify(content);
    if (saved.current === nextSignature) return;
    buffer();
    const value = await send({ action: "save", conversionId: active.conversionId, sessionId: sessionId.current, revision: active.revision, content }, keepalive);
    if (ticket !== generation.current) return;
    accept(value); saved.current = nextSignature; setSavedSignature(nextSignature);
    if (JSON.stringify(latest.current) === nextSignature) removeBuffer(); else buffer();
    setStatus("Saved across your devices");
    });
  };
  const load = async (resume: boolean, takeover = false) => {
    if (!scope) return;
    const ticket = generation.current;
    setChecking(true);
    setLoadError(null);
    try {
      await queue.current.catch(() => undefined);
      if (ticket !== generation.current) return;
      let value = await apiFetch<DraftResponse>(url);
      if (ticket !== generation.current) return;
      accept(value);
      if (!resume && editing && !owns.current) restore(value.draft?.content ?? empty);
      if (key) {
        try {
          const raw = localStorage.getItem(key);
          const local = raw && raw.length <= 6_100_000 ? JSON.parse(raw) as Buffer : null;
          if (local && (local.deadline <= Date.now() || local.conversionId !== value.draft?.conversionId)) removeBuffer();
        } catch { removeBuffer(); }
      }
      if (value.draft && resume) {
        const originalContent = value.draft.content;
        try {
          value = await send({ action: takeover ? "takeover" : "resume", conversionId: value.draft.conversionId, sessionId: sessionId.current });
          if (ticket !== generation.current) return;
          accept(value);
        } catch (error) {
          restore(originalContent);
          throw error;
        }
      }
      if (resume) {
        let content = value.draft?.content ?? empty;
        saved.current = JSON.stringify(content);
        setSavedSignature(saved.current);
        if (value.draft && key && owns.current) {
          try {
            const raw = localStorage.getItem(key);
            const local = raw && raw.length <= 6_100_000 ? JSON.parse(raw) as Buffer : null;
            if (local && local.deadline > Date.now() && local.conversionId === value.draft.conversionId && local.revision === value.draft.revision) {
              const parsed = DraftContentSchema.safeParse(local.content);
              if (parsed.success) content = parsed.data;
            } else removeBuffer();
          } catch { removeBuffer(); }
        }
        restore(content);
      }
      if (!value.draft) removeBuffer();
      if (!value.history.length && legacyKey) {
        try { setLegacy(readDraft(localStorage, legacyKey)); } catch { /* Optional legacy recovery. */ }
      } else {
        setLegacy(null);
        try { if (legacyKey) localStorage.removeItem(legacyKey); } catch { /* Retry on next access. */ }
      }
      setStatus(value.draft ? editing && !owns.current ? "Read-only — take over editing to continue." : "Saved across your devices" : "No saved draft");
    } catch (error) {
      if (ticket === generation.current) {
        const message = error instanceof Error ? error.message : "Draft storage unavailable";
        setStatus(message); setLoadError(message);
      }
    }
    finally { if (ticket === generation.current) setChecking(false); }
  };
  const loadInEffect = useEffectEvent(load);
  const release = () => {
    buffer();
    const active = current.current;
    const id = sessionId.current;
    if (!active || !owns.current) return;
    const content = latest.current;
    const savedContent = saved.current;
    // Capture scope/session/content before unmount. Never release the next workspace's draft.
    void enqueue(async () => {
      const post = async (body: object) => {
        const encoded = JSON.stringify(body);
        return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: encoded, keepalive: encoded.length < 60_000 });
      };
      if (JSON.stringify(content) !== savedContent) {
        const revision = current.current?.conversionId === active.conversionId ? current.current.revision : active.revision;
        await post({ action: "save", conversionId: active.conversionId, sessionId: id, revision, content });
      }
      await post({ action: "release", conversionId: active.conversionId, sessionId: id });
    }).catch(() => undefined);
  };
  const resetScope = useEffectEvent(() => {
    generation.current++;
    sessionId.current = crypto.randomUUID(); current.current = null; owns.current = false;
    setOwned(false); setResponse(null); saved.current = ""; setChecking(!!scope);
    if (!scope) restore(empty);
  });
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) resetScope(); });
    const guard = generation;
    return () => { cancelled = true; guard.current++; };
  }, [scope]); // Scope changes must never carry a user's content into another workspace.
  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadInEffect(editing); });
    const tick = window.setInterval(() => {
      setNow(Date.now() + serverOffset.current);
      if (!editing) { void loadInEffect(false); return; }
      if (!current.current || !owns.current) { void loadInEffect(false); return; }
      void enqueue(async () => {
        if (!current.current || !owns.current) return;
        accept(await send({ action: "heartbeat", conversionId: current.current.conversionId, sessionId: sessionId.current }));
      }).catch(error => setStatus(error instanceof Error ? error.message : "Draft storage unavailable"));
    }, HEARTBEAT_MS);
    const onHide = () => { if (editing) release(); };
    const onShow = () => { if (editing) void loadInEffect(true); };
    window.addEventListener("pagehide", onHide); window.addEventListener("pageshow", onShow);
    return () => {
      cancelled = true;
      window.clearInterval(tick); window.removeEventListener("pagehide", onHide); window.removeEventListener("pageshow", onShow);
      if (editing) release();
    };
    // Session transport is intentionally captured per scope; callbacks use current draft refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, editing]);
  useEffect(() => {
    if (!editing || !owned || restoring.current !== null || signature === saved.current) return;
    buffer();
    const timer = window.setTimeout(() => { void save().catch(error => setStatus(`Not saved across devices — ${error instanceof Error ? error.message : "connection unavailable"}`)); }, 600);
    return () => window.clearTimeout(timer);
    // Debounce document changes, not callback identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, owned, editing]);
  return {
    history: response?.history ?? [], now, checking: checking || session.isPending,
    error: loadError,
    conversionId: response?.draft?.conversionId,
    readOnly: !owned || checking, busy,
    status: status === "Saved across your devices" && signature !== savedSignature && editing ? "Saving changes…" : status,
    canTakeOver: !!response?.draft && !owned && !checking,
    takeover: () => load(true, true),
    refresh: () => load(editing),
    commitContent: async (content: DraftContent, expectedId?: string) => enqueue(async () => {
      let value = await apiFetch<DraftResponse>(url);
      const targetId = expectedId ?? current.current?.conversionId;
      if (!value.draft || !targetId || value.draft.conversionId !== targetId) throw new Error("The draft changed while reformatting. The newer conversion was preserved.");
      value = await send({ action: "resume", conversionId: targetId, sessionId: sessionId.current });
      value = await send({ action: "save", conversionId: targetId, sessionId: sessionId.current, revision: value.draft!.revision, content });
      if (!editing) value = await send({ action: "release", conversionId: targetId, sessionId: sessionId.current });
      accept(value); saved.current = JSON.stringify(content); setSavedSignature(saved.current); removeBuffer(); restore(content);
    }),
    legacy,
    recoverLegacy: async () => {
      if (!legacy) return;
      setBusy(true);
      try { await send({ action: "legacy", content: legacy }); setLegacy(null); await load(editing); }
      catch (error) { const message = error instanceof Error ? error.message : "Recovery unavailable"; setStatus(message); setLoadError(message); }
      finally { setBusy(false); }
    },
    clear: async () => {
      setBusy(true);
      try {
        await enqueue(async () => {
          if (!current.current || !owns.current) throw new Error("Take over editing before clearing this draft.");
          accept(await send({ action: "clear", conversionId: current.current.conversionId, sessionId: sessionId.current }));
        });
        removeBuffer(); restore(empty); setStatus("No saved draft"); return true;
      } catch (error) { setStatus(error instanceof Error ? error.message : "Could not clear draft"); return false; }
      finally { setBusy(false); }
    },
  };
}
