"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportPAPDiagnostic } from "../diagnostics/pap-diagnostics";
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
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertProgress = useCallback((nextProgress: PAPSendProgress) => {
    setProgress((currentProgress) => {
      const existing = currentProgress.find((item) => item.transferId === nextProgress.transferId);
      if (!existing) return [nextProgress, ...currentProgress];
      return currentProgress.map((item) => (item.transferId === nextProgress.transferId ? nextProgress : item));
    });
  }, []);

  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingIceCandidatesRef.current = [];
  }, []);

  const addIceCandidateWhenReady = useCallback(async (candidate: RTCIceCandidateInit) => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection || !peerConnection.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    await peerConnection.addIceCandidate(candidate);
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection || !peerConnection.remoteDescription) return;

    const pendingCandidates = pendingIceCandidatesRef.current.splice(0);
    for (const candidate of pendingCandidates) {
      await peerConnection.addIceCandidate(candidate);
    }
  }, []);

  const setupPeerConnection = useCallback(
    async (currentSession: PAPSession, message: Extract<PAPServerMessage, { type: "signal" }>) => {
      if (message.payload.type !== "offer") return;

      try {
        cleanup();
        const peerConnection = createPAPPeerConnection();
        peerConnectionRef.current = peerConnection;

        const channel = peerConnection.createDataChannel("pap-screenshots", {
          id: 0,
          negotiated: true,
          ordered: true,
        });
        dataChannelRef.current = channel;
        channel.addEventListener("open", () => {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setState("connected");
        });
        channel.addEventListener("close", () => setState("disconnected"));
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
        if (peerConnection.connectionState === "connected") {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setState("connected");
        }
        if (peerConnection.connectionState === "failed") {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setState("failed");
          reportPAPDiagnostic({
            event: "webrtc-failed",
            role: "mobile",
            pairingCode,
            sessionId: currentSession.id,
            peerId,
            state: peerConnection.connectionState,
            detail: getPeerConnectionDiagnosticDetail(peerConnection, dataChannelRef.current),
          });
        }
        if (peerConnection.connectionState === "disconnected") {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setState("disconnected");
          reportPAPDiagnostic({
            event: "webrtc-disconnected",
            role: "mobile",
            pairingCode,
            sessionId: currentSession.id,
            peerId,
            state: peerConnection.connectionState,
            detail: getPeerConnectionDiagnosticDetail(peerConnection, dataChannelRef.current),
          });
        }
      });

      connectionTimeoutRef.current = setTimeout(() => {
        if (peerConnection.connectionState === "connected" || dataChannelRef.current?.readyState === "open") return;

        reportPAPDiagnostic({
          event: "webrtc-timeout",
          role: "mobile",
          pairingCode,
          sessionId: currentSession.id,
          peerId,
          state: peerConnection.connectionState,
          detail: getPeerConnectionDiagnosticDetail(peerConnection, dataChannelRef.current),
        });
      }, 15_000);

      await peerConnection.setRemoteDescription(message.payload.description);
      await flushPendingIceCandidates();
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      signalingRef.current?.send({
        type: "signal",
        sessionId: currentSession.id,
        fromPeerId: peerId,
        payload: { type: "answer", description: answer },
      });
      } catch (error: unknown) {
        reportPAPDiagnostic({
          event: "webrtc-negotiation-error",
          role: "mobile",
          pairingCode,
          sessionId: currentSession.id,
          peerId,
          state: peerConnectionRef.current?.connectionState,
          message: error instanceof Error ? error.message : "Failed to process PAP WebRTC offer.",
          detail: peerConnectionRef.current
            ? getPeerConnectionDiagnosticDetail(peerConnectionRef.current, dataChannelRef.current)
            : { error },
        });
      }
    },
    [cleanup, flushPendingIceCandidates, pairingCode, peerId]
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
      onError: (detail) => {
        setState("failed");
        setError("Could not reach the PAP signaling service.");
        reportPAPDiagnostic({
          event: "signaling-error",
          role: "mobile",
          pairingCode,
          sessionId: sessionRef.current?.id,
          peerId,
          message: "Could not reach the PAP signaling service.",
          detail,
        });
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
            void addIceCandidateWhenReady(message.payload.candidate);
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
          reportPAPDiagnostic({
            event: "session-error",
            role: "mobile",
            pairingCode,
            sessionId: sessionRef.current?.id,
            peerId,
            message: message.message,
          });
        }
      },
    });

    signalingRef.current = signaling;

    return () => {
      signaling.close();
      cleanup();
    };
  }, [addIceCandidateWhenReady, cleanup, deviceName, pairingCode, peerId, setupPeerConnection]);

  return {
    deviceName,
    error,
    progress,
    sendFiles,
    session,
    state,
  };
}

function getPeerConnectionDiagnosticDetail(peerConnection: RTCPeerConnection, dataChannel?: RTCDataChannel | null) {
  return {
    iceConnectionState: peerConnection.iceConnectionState,
    iceGatheringState: peerConnection.iceGatheringState,
    signalingState: peerConnection.signalingState,
    dataChannelState: dataChannel?.readyState ?? null,
    hasRemoteDescription: Boolean(peerConnection.remoteDescription),
    hasLocalDescription: Boolean(peerConnection.localDescription),
  };
}
