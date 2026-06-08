"use client";

type PAPDiagnosticRole = "desktop" | "mobile";
type PAPDiagnosticEvent =
  | "signaling-error"
  | "signaling-closed"
  | "session-error"
  | "webrtc-failed"
  | "webrtc-disconnected";

type PAPDiagnosticPayload = {
  event: PAPDiagnosticEvent;
  role: PAPDiagnosticRole;
  pairingCode?: string;
  sessionId?: string;
  peerId?: string;
  state?: string;
  message?: string;
  detail?: unknown;
};

function getPAPSignalingMode() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "supabase-realtime";
  }

  return "websocket";
}

function getPAPSignalingTarget() {
  if (getPAPSignalingMode() === "supabase-realtime") {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  }

  return process.env.NEXT_PUBLIC_PAP_SIGNALING_URL ?? null;
}

export function reportPAPDiagnostic(payload: PAPDiagnosticPayload) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    href: window.location.href,
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    signalingMode: getPAPSignalingMode(),
    signalingTarget: getPAPSignalingTarget(),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabasePublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    hasPAPSignalingUrl: Boolean(process.env.NEXT_PUBLIC_PAP_SIGNALING_URL),
    occurredAt: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/pap/diagnostics", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  void fetch("/api/pap/diagnostics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
