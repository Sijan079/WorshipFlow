"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPAPPeerConnection, sendPAPFiles } from "../rtc/pap-rtc";
import type { PAPConnectionState, PAPSendProgress, PAPServerMessage, PAPSession } from "../types";
import { connectPAPSignaling, createPAPPeerId, getPAPDeviceName } from "../websocket/pap-signaling-client";

export function usePAPMobileSender(pairingCode: string) {
  const [peerId] = useState(() => createPAPPeerId("mobile"));
  const [deviceName] = useState(() => getPAPDeviceName("mobile"));
  const [session, setSession] = useState<PAPSession | null>(null);
  const [state, setState] = useState<PAPConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PAPSendProgress[]>([]);

  const signalingRef = useRef<ReturnType<typeof connectPAPSignaling> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionRef = useRef<PAPSession | null>(null);

  const upsertProgress = useCallback((nextProgress: PAPSendProgress) => {
    setProgress((currentProgress) => {
      const existing = currentProgress.find((item) => item.transferId === nextProgress.transferId);
      if (!existing) return [nextProgress, ...currentProgress];
      return currentProgress.map((item) => (item.transferId === nextProgress.transferId ? nextProgress : item));
    });
  }, []);

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
  }, []);

  const setupPeerConnection = useCallback(
    async (currentSession: PAPSession, message: Extract<PAPServerMessage, { type: "signal" }>) => {
      if (message.payload.type !== "offer") return;

      cleanup();
      const peerConnection = createPAPPeerConnection();
      peerConnectionRef.current = peerConnection;

      peerConnection.addEventListener("datachannel", (event) => {
        dataChannelRef.current = event.channel;
        event.channel.addEventListener("open", () => setState("connected"));
        event.channel.addEventListener("close", () => setState("disconnected"));
      });
      peerConnection.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          signalingRef.current?.send({
            type: "signal",
            sessionId: currentSession.id,
            fromPeerId: peerId,
            payload: { type: "ice-candidate", candidate: event.candidate.toJSON() },
          });
        }
      });
      peerConnection.addEventListener("connectionstatechange", () => {
        if (peerConnection.connectionState === "connected") setState("connected");
        if (peerConnection.connectionState === "failed") setState("failed");
        if (peerConnection.connectionState === "disconnected") setState("disconnected");
      });

      await peerConnection.setRemoteDescription(message.payload.description);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      signalingRef.current?.send({
        type: "signal",
        sessionId: currentSession.id,
        fromPeerId: peerId,
        payload: { type: "answer", description: answer },
      });
    },
    [cleanup, peerId]
  );

  const sendFiles = useCallback(
    async (files: File[]) => {
      const channel = dataChannelRef.current;
      if (!channel || channel.readyState !== "open") {
        setError("The PAP connection is not ready yet.");
        return;
      }

      setError(null);
      await sendPAPFiles({
        channel,
        files,
        onProgress: upsertProgress,
      });
    },
    [upsertProgress]
  );

  useEffect(() => {
    const signaling = connectPAPSignaling({
      onOpen: () => {
        signaling.send({ type: "join-session", pairingCode, peerId, deviceName });
      },
      onClose: () => setState((current) => (current === "expired" ? current : "disconnected")),
      onError: () => {
        setState("failed");
        setError("Could not reach the PAP desktop signaling server.");
      },
      onMessage: (message) => {
        if (message.type === "session-joined") {
          sessionRef.current = message.session;
          setSession(message.session);
          setState("connecting");
          return;
        }
        if (message.type === "signal") {
          if (message.payload.type === "offer" && sessionRef.current) {
            void setupPeerConnection(sessionRef.current, message);
          } else if (message.payload.type === "ice-candidate") {
            void peerConnectionRef.current?.addIceCandidate(message.payload.candidate);
          }
          return;
        }
        if (message.type === "session-expired") {
          setState("expired");
          setError("This PAP session expired. Ask the desktop to create a new code.");
          sessionRef.current = null;
          cleanup();
          return;
        }
        if (message.type === "peer-left") {
          setState("disconnected");
          cleanup();
          return;
        }
        if (message.type === "error") {
          setError(message.message);
          setState("failed");
        }
      },
    });

    signalingRef.current = signaling;

    return () => {
      signaling.close();
      cleanup();
    };
  }, [cleanup, deviceName, pairingCode, peerId, setupPeerConnection]);

  return {
    deviceName,
    error,
    progress,
    sendFiles,
    session,
    state,
  };
}
