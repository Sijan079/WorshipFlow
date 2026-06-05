import type { PAPClientMessage, PAPServerMessage } from "../types";

export function createPAPPeerId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function getPAPDeviceName(role: "desktop" | "mobile") {
  if (typeof navigator === "undefined") {
    return role === "desktop" ? "Worship Flow Desktop" : "Mobile Device";
  }

  const platform = navigator.platform || navigator.userAgent;
  if (role === "desktop") {
    return `Worship Flow Desktop (${platform})`;
  }
  return /iphone|android|mobile/i.test(navigator.userAgent) ? "Mobile Phone" : `Mobile Device (${platform})`;
}

export function getPAPSignalingUrl() {
  if (process.env.NEXT_PUBLIC_PAP_SIGNALING_URL) {
    return process.env.NEXT_PUBLIC_PAP_SIGNALING_URL;
  }

  if (typeof window === "undefined") {
    return "ws://localhost:3001";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001`;
}

export function getPAPJoinBaseUrl() {
  if (process.env.NEXT_PUBLIC_PAP_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_PAP_PUBLIC_URL.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  return window.location.origin;
}

export function connectPAPSignaling(params: {
  onMessage: (message: PAPServerMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
}) {
  const socket = new WebSocket(getPAPSignalingUrl());

  socket.addEventListener("open", () => params.onOpen?.());
  socket.addEventListener("close", () => params.onClose?.());
  socket.addEventListener("error", () => params.onError?.());
  socket.addEventListener("message", (event) => {
    try {
      params.onMessage(JSON.parse(String(event.data)) as PAPServerMessage);
    } catch {
      params.onMessage({ type: "error", message: "Received an invalid PAP signaling message." });
    }
  });

  return {
    socket,
    send(message: PAPClientMessage) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
    close() {
      socket.close();
    },
  };
}
