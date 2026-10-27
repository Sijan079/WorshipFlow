"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { CaptionAssembler, latestCaptionLines, type CaptionUpdate } from "./caption-contract";
import { CaptionStreamConnection } from "./caption-connection";
import type { CaptionRunState } from "./caption-ui";
import {
  fetchActiveSession, fetchDeepgramToken, publishLine, sendPresence, startSession, stopSession,
  stopSessionOnLeave, type CaptionLine, type CaptionSession, type PresenceStatus,
} from "./caption-session-api";
import { clearOperatorToken, loadOperatorToken, saveOperatorToken } from "./operator-token-store";

type Notify = (message: string, tone: "success" | "error") => void;

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
export function useCaptionSession({ inputId, notify }: { inputId: string; notify: Notify }) {
  const [session, setSession] = useState<CaptionSession | null>(null);
  const [operatorToken, setOperatorToken] = useState("");
  const [canOperate, setCanOperate] = useState(false);
  const [state, setState] = useState<CaptionRunState>("idle");
  const [message, setMessage] = useState("Choose an audio input with the options button, then start captions.");
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [canShare, setCanShare] = useState(false);
  const [canRegenerate, setCanRegenerate] = useState(false);
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
  const quotaNotifiedRef = useRef(false);
  const connectionStatusRef = useRef<PresenceStatus>("CONNECTING");

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
    void fetchActiveSession().then(({ session: current, canOperate: allowed, canShare: share, canRegenerate: regenerate }) => {
      if (!mounted) return;
      setCanOperate(allowed);
      setCanShare(share);
      setCanRegenerate(regenerate);
      if (!current) {
        if (!allowed) setMessage("A workspace admin can grant you permission to operate Sermon Captions in Membership settings.");
        return;
      }
      setSession(current);
      const savedToken = loadOperatorToken(current.id);
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
      if (active) stopSessionOnLeave(active.id, active.token);
      releaseAudio();
    };
  }, [releaseAudio]);

  function heartbeat(status: PresenceStatus) {
    const active = activeRef.current;
    if (!active) return;
    sendPresence(active.id, active.token, status, ++presenceSequenceRef.current);
  }

  function publish(update: CaptionUpdate) {
    const active = activeRef.current;
    if (!active) return;
    queueRef.current = queueRef.current.then(async () => {
      const line = await publishLine(active.id, active.token, update);
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
      activeRef.current = { id: current.id, token };
      expiryTimerRef.current = window.setTimeout(() => void stop(), Math.max(0, new Date(current.expiresAt).getTime() - Date.now()));
      saveOperatorToken(current.id, token);
      setSession(current);
      setOperatorToken(token);
      setLines([]);
      assemblerRef.current = new CaptionAssembler();
      queueRef.current = Promise.resolve();
      stoppingRef.current = false;
      presenceSequenceRef.current = 0;
      quotaNotifiedRef.current = false;
      connectionStatusRef.current = "CONNECTING";
      presenceTimerRef.current = window.setInterval(() => heartbeat(connectionStatusRef.current), 5_000);

      const connection = new CaptionStreamConnection({
        initialToken: deepgramToken,
        getToken: () => fetchDeepgramToken(current.id, token),
        createSocket: openDeepgramSocket,
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
    state, session, message, lines, canOperate, canShare, canRegenerate,
    canStopExisting: canOperate && Boolean(operatorToken || session?.canManage),
    start, stop, stopExisting,
  };
}
