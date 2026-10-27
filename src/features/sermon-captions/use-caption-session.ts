"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { CaptionAssembler, latestCaptionLines, type CaptionUpdate } from "./caption-contract";
import { CaptionStreamConnection } from "./caption-connection";
import { createTicker } from "./heartbeat-ticker";
import { recognitionLagMs } from "./caption-metrics";
import { canResumeSession } from "./caption-resume";
import { claimStreamLock } from "./stream-lock";
import type { CaptionRunState } from "./caption-ui";
import {
  extendSession, fetchActiveSession, fetchDeepgramToken, publishLine, sendPresence, startSession, stopSession,
  stopSessionOnLeave, type CaptionLine, type CaptionSession, type PresenceStatus,
} from "./caption-session-api";
import { clearOperatorToken, loadOperatorInput, loadOperatorToken, saveOperatorInput, saveOperatorToken } from "./operator-token-store";

type Notify = (message: string, tone: "success" | "error" | "info") => void;

const STOPPED_MESSAGE = "Caption session stopped. The final captions remain on the shared viewer for one hour.";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Caption request failed.";
}

function openDeepgramSocket(token: string) {
  return new WebSocket("wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&language_hint=tl&language_hint=en&interim_results=true&smart_format=true&endpointing=500", ["bearer", token]);
}

// Owns one captions session from start to stop: the audio stream, the provider connection, the
// queue that publishes each line, the heartbeat, and the expiry. It renders nothing, and it must
// stay mounted for the whole visit because leaving the page ends the session.
type InputChoice = { id: string; label: string };

export function useCaptionSession({ inputId, inputLabel, notify, enabled, onInputRestored }: { inputId: string; inputLabel: string; notify: Notify; enabled: boolean; onInputRestored: (input: InputChoice) => void }) {
  const [session, setSession] = useState<CaptionSession | null>(null);
  const [operatorToken, setOperatorToken] = useState("");
  const [canOperate, setCanOperate] = useState(false);
  const [state, setState] = useState<CaptionRunState>("idle");
  const [message, setMessage] = useState("Choose an audio input with the options button, then start captions.");
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [canShare, setCanShare] = useState(false);
  const [canRegenerate, setCanRegenerate] = useState(false);
  const [devAgainstLiveDatabase, setDevAgainstLiveDatabase] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<CaptionStreamConnection | null>(null);
  const assemblerRef = useRef(new CaptionAssembler());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const activeRef = useRef<{ id: string; token: string } | null>(null);
  const stoppingRef = useRef(false);
  const mountedRef = useRef(true);
  const expiryTimerRef = useRef<number | null>(null);
  const presenceTickerRef = useRef<{ stop: () => void } | null>(null);
  const presenceSequenceRef = useRef(0);
  const quotaNotifiedRef = useRef(false);
  const streamLockRef = useRef<{ release: () => void } | null>(null);
  // Timing only: when this audio stream began, and how long the last publish took.
  const streamStartRef = useRef(0);
  const lastRoundTripRef = useRef<number | undefined>(undefined);
  const resumeRef = useRef<((current: CaptionSession, token: string, saved: InputChoice) => Promise<void>) | null>(null);
  const connectionStatusRef = useRef<PresenceStatus>("CONNECTING");

  const releaseAudio = useCallback(() => {
    if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
    expiryTimerRef.current = null;
    presenceTickerRef.current?.stop();
    presenceTickerRef.current = null;
    streamLockRef.current?.release();
    streamLockRef.current = null;
    connectionRef.current?.stop();
    connectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const retryOnOnline = () => connectionRef.current?.retryNow();
    const reconnectOnOffline = () => connectionRef.current?.interrupt();
    window.addEventListener("online", retryOnOnline);
    window.addEventListener("offline", reconnectOnOffline);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", retryOnOnline);
      window.removeEventListener("offline", reconnectOnOffline);
      stoppingRef.current = true;
      const active = activeRef.current;
      activeRef.current = null;
      if (active) stopSessionOnLeave(active.id, active.token);
      releaseAudio();
    };
  }, [releaseAudio]);

  // The first look at the church's session, only for people who can view captions: a refused request is
  // reported to error notifications.
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    void fetchActiveSession().then(({ session: current, canOperate: allowed, canShare: share, canRegenerate: regenerate, devAgainstLiveDatabase: devLive }) => {
      if (!mounted) return;
      setCanOperate(allowed);
      setCanShare(share);
      setCanRegenerate(regenerate);
      setDevAgainstLiveDatabase(devLive);
      if (!current) {
        if (!allowed) setMessage("A workspace admin can grant you permission to operate Sermon Captions in Membership settings.");
        return;
      }
      setSession(current);
      const savedToken = loadOperatorToken(current.id);
      setOperatorToken(savedToken);
      // The booth page was reloaded while its session was live: reconnect to the same session and link.
      const savedInput = loadOperatorInput(current.id);
      if (canResumeSession({ allowed, token: savedToken, inputId: savedInput.id })) {
        void resumeRef.current?.(current, savedToken, savedInput);
        return;
      }
      setMessage(allowed && (savedToken || current.canManage) ? "A session is active. Start a new one after stopping it." : "Another operator is running captions.");
    }).catch((error) => { if (mounted) setMessage(errorMessage(error)); });
    return () => { mounted = false; };
  }, [enabled]);

  function heartbeat(status: PresenceStatus) {
    const active = activeRef.current;
    if (!active) return;
    sendPresence(active.id, active.token, status, ++presenceSequenceRef.current);
  }

  function publish(update: CaptionUpdate) {
    const active = activeRef.current;
    if (!active) return;
    queueRef.current = queueRef.current.then(async () => {
      const startedAt = performance.now();
      const line = await publishLine(active.id, active.token, update, lastRoundTripRef.current);
      lastRoundTripRef.current = Math.round(performance.now() - startedAt);
      setLines((previous) => latestCaptionLines(previous, line));
    }).catch((error) => {
      // Azure's allowance is used up: say so plainly, once, instead of repeating "interrupted".
      if (error instanceof ApiError && error.status === 429) {
        setMessage(error.message);
        if (!quotaNotifiedRef.current) { quotaNotifiedRef.current = true; notify(error.message, "error"); }
        return;
      }
      setMessage(`Translation interrupted: ${errorMessage(error)}`);
    });
  }

  async function stop() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    presenceTickerRef.current?.stop();
    presenceTickerRef.current = null;
    setState("stopping");
    setMessage("Finishing the last caption…");
    const active = activeRef.current;
    try {
      await connectionRef.current?.finish();
      for (const update of assemblerRef.current.flush()) publish(update);
      await queueRef.current;
      if (active) {
        await stopSession(active.id, active.token);
        clearOperatorToken(active.id);
      }
      activeRef.current = null;
      setSession(null);
      setOperatorToken("");
      setMessage(STOPPED_MESSAGE);
      notify("Captions stopped.", "success");
    } catch (error) {
      setMessage(`Could not finish the session: ${errorMessage(error)}`);
      notify(`Could not finish the session: ${errorMessage(error)}`, "error");
    } finally {
      releaseAudio();
      setState("idle");
      stoppingRef.current = false;
    }
  }

  // Wires one session to the audio stream and the caption provider. Start uses it for a new session, and
  // resuming after a reload uses it for the same one (with `startAfterLine` so numbering continues).
  function beginStreaming(current: CaptionSession, token: string, deepgramToken: string, stream: MediaStream, mimeType: string, input: InputChoice, startAfterLine: number) {
    activeRef.current = { id: current.id, token };
    expiryTimerRef.current = window.setTimeout(() => void stop(), Math.max(0, new Date(current.expiresAt).getTime() - Date.now()));
    saveOperatorToken(current.id, token);
    saveOperatorInput(current.id, input);
    setSession(current);
    setOperatorToken(token);
    setLines([]);
    assemblerRef.current = new CaptionAssembler(startAfterLine);
    queueRef.current = Promise.resolve();
    stoppingRef.current = false;
    presenceSequenceRef.current = 0;
    quotaNotifiedRef.current = false;
    lastRoundTripRef.current = undefined;
    connectionStatusRef.current = "CONNECTING";
    presenceTickerRef.current = createTicker(5_000, () => heartbeat(connectionStatusRef.current));

    const connection = new CaptionStreamConnection({
      initialToken: deepgramToken,
      getToken: () => fetchDeepgramToken(current.id, token),
      createSocket: openDeepgramSocket,
      // Each new connection restarts the audio clock, so the start time is taken when its recorder is made.
      createRecorder: () => {
        streamStartRef.current = performance.now();
        return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      },
      onMessage: (data) => {
        try {
          const result = JSON.parse(String(data));
          const recognitionMs = recognitionLagMs({ streamElapsedMs: performance.now() - streamStartRef.current, start: result.start, duration: result.duration });
          for (const update of assemblerRef.current.accept(result)) publish({ ...update, recognitionMs });
        } catch { /* Ignore non-transcript provider events. */ }
      },
      onState: (connectionState, attempts) => {
        if (!mountedRef.current || stoppingRef.current) return;
        setState(connectionState === "connecting" ? "starting" : connectionState);
        const nextStatus: PresenceStatus = connectionState === "live" ? "STREAMING"
          : connectionState === "reconnecting" ? "INTERRUPTED"
            : connectionState === "error" ? "ERROR" : "CONNECTING";
        if (connectionStatusRef.current !== nextStatus) {
          connectionStatusRef.current = nextStatus;
          heartbeat(nextStatus);
        }
        if (connectionState === "live" && attempts === 0) notify("Captions are live.", "success");
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
    stream.getAudioTracks()[0]?.addEventListener("ended", () => { void stop(); }, { once: true });
  }

  async function start() {
    if (!canOperate || !inputId || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Choose an audio input with the options button and use a browser with microphone support.");
      return;
    }
    setState("starting");
    setMessage("Opening the selected audio input…");
    let created: Awaited<ReturnType<typeof startSession>> | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: inputId } } });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      created = await startSession();
      if (!mountedRef.current) {
        await stopSession(created.session.id, created.operatorToken);
        releaseAudio();
        return;
      }
      const { session: current, operatorToken: token, deepgramToken } = created;
      if (created.budget?.state === "warning") notify(`Translation use is at ${created.budget.percent}% of this month's limit.`, "info");
      // A new session: nobody else can hold its stream. The lock keeps a duplicated tab from resuming it.
      streamLockRef.current = await claimStreamLock(current.id);
      beginStreaming(current, token, deepgramToken, stream, mimeType, { id: inputId, label: inputLabel }, 0);
    } catch (error) {
      stoppingRef.current = true;
      activeRef.current = null;
      releaseAudio();
      if (created) {
        try {
          await stopSession(created.session.id, created.operatorToken);
        } catch { /* The expiry still closes an orphaned session. */ }
        clearOperatorToken(created.session.id);
      }
      setSession(null);
      setOperatorToken("");
      setState("idle");
      stoppingRef.current = false;
      setMessage(`Could not start captions: ${errorMessage(error)}`);
      notify(`Could not start captions: ${errorMessage(error)}`, "error");
    }
  }

  // After a reload of the booth page: reconnect to the session that was running, with the same input.
  // If this tab cannot (another tab holds the stream, or the browser wants the microphone permission
  // again), it says what to do instead.
  async function resumeStreaming(current: CaptionSession, token: string, saved: InputChoice) {
    const lock = await claimStreamLock(current.id);
    if (!lock) {
      setMessage("Captions are already running in another tab of this browser.");
      return;
    }
    streamLockRef.current = lock;
    setState("starting");
    setMessage("Reconnecting to the session that was running before the page reloaded…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: saved.id } } });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); lock.release(); streamLockRef.current = null; return; }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const deepgramToken = await fetchDeepgramToken(current.id, token);
      onInputRestored(saved);
      stoppingRef.current = false;
      beginStreaming(current, token, deepgramToken, stream, mimeType, saved, current.lastLine ?? 0);
      setMessage("Captions resumed after the page reloaded. Audio during the gap may be missing.");
      notify("Captions resumed.", "success");
    } catch {
      releaseAudio();
      setState("idle");
      setMessage("Captions were running before this page reloaded, and this browser did not allow the input again. Press Stop current session, then Start captions.");
    }
  }

  // Keeps the latest resume function reachable from the first-look effect without making it re-run.
  useEffect(() => { resumeRef.current = resumeStreaming; });

  // Adds four hours to the running session and moves the automatic stop to the new end.
  async function extend() {
    const active = activeRef.current;
    if (!active || !session) return;
    try {
      const { expiresAt } = await extendSession(active.id, active.token);
      if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = window.setTimeout(() => void stop(), Math.max(0, new Date(expiresAt).getTime() - Date.now()));
      setSession({ ...session, expiresAt });
      notify("Captions extended by four hours.", "success");
    } catch (error) {
      notify(`Could not extend captions: ${errorMessage(error)}`, "error");
    }
  }

  // Stops a session this page did not start (found on load, or left from an earlier visit).
  async function stopExisting() {
    if (!session) return;
    try {
      await stopSession(session.id, operatorToken || undefined);
      clearOperatorToken(session.id);
      setSession(null);
      setOperatorToken("");
      setMessage(STOPPED_MESSAGE);
      notify("Captions stopped.", "success");
    } catch (error) { setMessage(errorMessage(error)); notify(errorMessage(error), "error"); }
  }

  return {
    state, session, message, lines, canOperate, canShare, canRegenerate, devAgainstLiveDatabase,
    canStopExisting: canOperate && Boolean(operatorToken || session?.canManage),
    start, stop, stopExisting, extend,
  };
}
