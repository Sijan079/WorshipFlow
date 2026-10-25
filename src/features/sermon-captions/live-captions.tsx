"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch, workspaceApiPath } from "@/lib/api-client";
import { CaptionAssembler, latestCaptionLines, type CaptionUpdate } from "./caption-contract";
import { CaptionStreamConnection } from "./caption-connection";

type Session = { id: string; operatorUserId?: string; createdAt: string; expiresAt: string; canManage?: boolean };
type Line = { line: number; english: string; final: boolean };
type StartResponse = { session: Session; operatorToken: string; deepgramToken: string };
type LineResponse = { line: Line };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Caption request failed.";
}

export default function LiveCaptions({ inputId }: { inputId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [operatorToken, setOperatorToken] = useState("");
  const [canOperate, setCanOperate] = useState(false);
  const [state, setState] = useState<"idle" | "starting" | "live" | "reconnecting" | "error" | "stopping">("idle");
  const [message, setMessage] = useState("Select an audio input, then start captions.");
  const [lines, setLines] = useState<Line[]>([]);
  const [viewerUrl, setViewerUrl] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<CaptionStreamConnection | null>(null);
  const assemblerRef = useRef(new CaptionAssembler());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const activeRef = useRef<{ id: string; token: string } | null>(null);
  const stoppingRef = useRef(false);
  const mountedRef = useRef(true);
  const expiryTimerRef = useRef<number | null>(null);
  const presenceTimerRef = useRef<number | null>(null);
  const presenceSequenceRef = useRef(0);
  const connectionStatusRef = useRef<"CONNECTING" | "STREAMING" | "INTERRUPTED" | "ERROR">("CONNECTING");

  const releaseAudio = useCallback(() => {
    if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
    expiryTimerRef.current = null;
    if (presenceTimerRef.current !== null) window.clearInterval(presenceTimerRef.current);
    presenceTimerRef.current = null;
    connectionRef.current?.stop();
    connectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;
    const retryOnOnline = () => connectionRef.current?.retryNow();
    const reconnectOnOffline = () => connectionRef.current?.interrupt();
    window.addEventListener("online", retryOnOnline);
    window.addEventListener("offline", reconnectOnOffline);
    void apiFetch<{ session: Session | null; canOperate: boolean }>("/api/caption-sessions").then(({ session: current, canOperate: allowed }) => {
      if (!mounted) return;
      setCanOperate(allowed);
      if (!current) {
        if (!allowed) setMessage("A workspace admin can grant you permission to operate Sermon Captions in Membership settings.");
        return;
      }
      setSession(current);
      setViewerUrl(`${window.location.origin}/captions/live/${current.id}`);
      const savedToken = sessionStorage.getItem(`caption-operator-${current.id}`) || "";
      setOperatorToken(savedToken);
      setMessage(allowed && (savedToken || current.canManage) ? "A session is active. Start a new one after stopping it." : "Another operator is running captions.");
    }).catch((error) => { if (mounted) setMessage(errorMessage(error)); });
    return () => {
      mounted = false;
      mountedRef.current = false;
      window.removeEventListener("online", retryOnOnline);
      window.removeEventListener("offline", reconnectOnOffline);
      stoppingRef.current = true;
      const active = activeRef.current;
      activeRef.current = null;
      if (active) {
        const { id, token } = active;
        void fetch(workspaceApiPath(`/api/caption-sessions/${id}/stop`), {
          method: "POST", headers: { "x-caption-operator-token": token }, keepalive: true,
        });
      }
      releaseAudio();
    };
  }, [releaseAudio]);

  function sendPresence(status: "CONNECTING" | "STREAMING" | "INTERRUPTED" | "ERROR") {
    const active = activeRef.current;
    if (!active) return;
    const sequence = ++presenceSequenceRef.current;
    void fetch(workspaceApiPath(`/api/caption-sessions/${active.id}/presence`), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-caption-operator-token": active.token },
      body: JSON.stringify({ state: status, sequence }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    }).catch(() => { /* The public feed detects stale heartbeats during an outage. */ });
  }

  function publish(update: CaptionUpdate) {
    const active = activeRef.current;
    if (!active) return;
    queueRef.current = queueRef.current.then(async () => {
      const result = await apiFetch<LineResponse>(`/api/caption-sessions/${active.id}/lines`, {
        method: "POST",
        headers: { "x-caption-operator-token": active.token },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(15_000),
      });
      setLines((previous) => latestCaptionLines(previous, result.line));
    }).catch((error) => { setMessage(`Translation interrupted: ${errorMessage(error)}`); });
  }

  async function endSession() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    if (presenceTimerRef.current !== null) window.clearInterval(presenceTimerRef.current);
    presenceTimerRef.current = null;
    setState("stopping");
    setMessage("Finishing the last caption…");
    const active = activeRef.current;
    try {
      await connectionRef.current?.finish();
      for (const update of assemblerRef.current.flush()) publish(update);
      await queueRef.current;
      if (active) {
        await apiFetch(`/api/caption-sessions/${active.id}/stop`, { method: "POST", headers: { "x-caption-operator-token": active.token } });
        sessionStorage.removeItem(`caption-operator-${active.id}`);
      }
      activeRef.current = null;
      setSession(null);
      setViewerUrl("");
      setOperatorToken("");
      setMessage("Caption session stopped. The final captions remain on the shared viewer for one hour.");
    } catch (error) {
      setMessage(`Could not finish the session: ${errorMessage(error)}`);
    } finally {
      releaseAudio();
      setState("idle");
      stoppingRef.current = false;
    }
  }

  async function start() {
    if (!canOperate || !inputId || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Choose an audio input in Audio setup and use a browser with microphone support.");
      return;
    }
    setState("starting");
    setMessage("Opening the selected audio input…");
    let created: StartResponse | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: inputId } } });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      created = await apiFetch<StartResponse>("/api/caption-sessions", { method: "POST" });
      if (!mountedRef.current) {
        await apiFetch(`/api/caption-sessions/${created.session.id}/stop`, { method: "POST", headers: { "x-caption-operator-token": created.operatorToken } });
        releaseAudio();
        return;
      }
      const { session: current, operatorToken: token, deepgramToken } = created;
      activeRef.current = { id: current.id, token };
      expiryTimerRef.current = window.setTimeout(() => void endSession(), Math.max(0, new Date(current.expiresAt).getTime() - Date.now()));
      sessionStorage.setItem(`caption-operator-${current.id}`, token);
      setSession(current);
      setOperatorToken(token);
      setViewerUrl(`${window.location.origin}/captions/live/${current.id}`);
      setLines([]);
      assemblerRef.current = new CaptionAssembler();
      queueRef.current = Promise.resolve();
      stoppingRef.current = false;
      presenceSequenceRef.current = 0;
      connectionStatusRef.current = "CONNECTING";
      presenceTimerRef.current = window.setInterval(() => sendPresence(connectionStatusRef.current), 5_000);

      const connection = new CaptionStreamConnection({
        initialToken: deepgramToken,
        getToken: async () => {
          const response = await apiFetch<{ deepgramToken: string }>(`/api/caption-sessions/${current.id}/token`, {
            method: "POST", headers: { "x-caption-operator-token": token }, signal: AbortSignal.timeout(10_000),
          });
          return response.deepgramToken;
        },
        createSocket: (freshToken) => new WebSocket("wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&language_hint=tl&language_hint=en&interim_results=true&smart_format=true&endpointing=500", ["bearer", freshToken]),
        createRecorder: () => new MediaRecorder(stream, mimeType ? { mimeType } : undefined),
        onMessage: (data) => {
          try {
            const result = JSON.parse(String(data));
            for (const update of assemblerRef.current.accept(result)) publish(update);
          } catch { /* Ignore non-transcript provider events. */ }
        },
        onState: (connectionState, attempts) => {
          if (!mountedRef.current || stoppingRef.current) return;
          setState(connectionState === "connecting" ? "starting" : connectionState);
          const nextStatus = connectionState === "live" ? "STREAMING"
            : connectionState === "reconnecting" ? "INTERRUPTED"
              : connectionState === "error" ? "ERROR" : "CONNECTING";
          if (connectionStatusRef.current !== nextStatus) {
            connectionStatusRef.current = nextStatus;
            sendPresence(nextStatus);
          }
          setMessage(connectionState === "reconnecting"
            ? "Connection interrupted. Reconnecting automatically; keep this page open."
            : connectionState === "error"
              ? "Caption stream closed with an audio or access error. The booth team needs to check it."
            : connectionState === "live" && attempts > 0
              ? "Captions resumed on the same viewer link. Audio during the interruption may be missing."
              : connectionState === "connecting"
                ? "Connecting to Deepgram with the selected PC input."
                : "Listening to the selected PC input and publishing English captions.");
        },
        onDisconnect: () => { for (const update of assemblerRef.current.flush()) publish(update); },
        isFatalTokenError: (error) => error instanceof ApiError && [401, 403, 404, 409].includes(error.status),
      });
      connectionRef.current = connection;
      connection.start();
      stream.getAudioTracks()[0]?.addEventListener("ended", () => { void endSession(); }, { once: true });
    } catch (error) {
      stoppingRef.current = true;
      activeRef.current = null;
      releaseAudio();
      if (created) {
        try {
          await apiFetch(`/api/caption-sessions/${created.session.id}/stop`, { method: "POST", headers: { "x-caption-operator-token": created.operatorToken } });
        } catch { /* The expiry still closes an orphaned session. */ }
        sessionStorage.removeItem(`caption-operator-${created.session.id}`);
      }
      setSession(null);
      setOperatorToken("");
      setViewerUrl("");
      setState("idle");
      stoppingRef.current = false;
      setMessage(`Could not start captions: ${errorMessage(error)}`);
    }
  }

  async function stopExisting() {
    if (!session) return;
    try {
      await apiFetch(`/api/caption-sessions/${session.id}/stop`, { method: "POST", headers: operatorToken ? { "x-caption-operator-token": operatorToken } : undefined });
      sessionStorage.removeItem(`caption-operator-${session.id}`);
      setSession(null);
      setOperatorToken("");
      setViewerUrl("");
      setMessage("Caption session stopped. The final captions remain on the shared viewer for one hour.");
    } catch (error) { setMessage(errorMessage(error)); }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Live captions</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Tagalog and English speech · English text</p>
        </div>
        <span className="text-sm font-medium text-[var(--text-secondary)]">{state === "live" ? "Live" : state === "reconnecting" ? "Reconnecting" : state === "error" ? "Needs attention" : session ? "Session active" : "Ready to start"}</span>
      </div>
      <div className="min-h-52 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-5" aria-live="polite" aria-relevant="additions text">
        {lines.length ? <div className="space-y-3">{lines.map((item) => <p key={item.line} className={`text-lg leading-relaxed text-[var(--text-primary)] ${item.final ? "" : "opacity-75"}`}>{item.english}</p>)}</div>
          : <p className="flex min-h-40 items-center justify-center text-center text-sm text-[var(--text-secondary)]">English captions will appear here after speech is recognized.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {state === "live" || state === "reconnecting" || state === "error" || state === "stopping" || (state === "starting" && session) ? <button type="button" onClick={() => void endSession()} disabled={state === "stopping"} className="ui-btn-secondary min-h-11 px-5 text-sm font-semibold disabled:opacity-50">Stop captions</button>
          : session ? <button type="button" onClick={() => void stopExisting()} disabled={!canOperate || (!operatorToken && !session.canManage)} className="ui-btn-secondary min-h-11 px-5 text-sm font-semibold disabled:opacity-50">Stop current session</button>
            : <button type="button" onClick={() => void start()} disabled={!canOperate || !inputId || state === "starting"} className="ui-btn-primary min-h-11 px-5 text-sm font-semibold disabled:opacity-50">Start captions</button>}
        <p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p>
      </div>
      {viewerUrl ? <div className="border-t border-[var(--rule-default)] pt-4">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Text-only viewer</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a className="break-all text-sm text-[var(--text-accent)] underline underline-offset-2" href={viewerUrl} target="_blank" rel="noopener noreferrer">{viewerUrl}</a>
          <button type="button" className="ui-btn-secondary min-h-10 px-3 text-sm font-semibold" onClick={() => void navigator.clipboard.writeText(viewerUrl).then(() => setMessage("Viewer link copied."), () => setMessage("Could not copy the link. Select and copy it instead."))}>Copy link</button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">Anyone with this link can read the English captions during the broadcast and for one hour after it stops.</p>
      </div> : null}
    </div>
  );
}
