import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PAP_SESSION_TTL_MS, type PAPClientMessage, type PAPServerMessage, type PAPSession } from "../types";

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

type PAPSignalingParams = {
  onMessage: (message: PAPServerMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (detail?: unknown) => void;
};

export function connectPAPSignaling(params: {
  onMessage: (message: PAPServerMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (detail?: unknown) => void;
}) {
  if (hasSupabaseRealtimeConfig() && process.env.NEXT_PUBLIC_PAP_SIGNALING_TRANSPORT === "supabase-realtime") {
    return connectSupabasePAPSignaling(params);
  }

  if (hasSupabaseRealtimeConfig()) {
    return connectAPIPAPSignaling(params);
  }

  const socket = new WebSocket(getPAPSignalingUrl());

  socket.addEventListener("open", () => params.onOpen?.());
  socket.addEventListener("close", () => params.onClose?.());
  socket.addEventListener("error", (event) => params.onError?.({ transport: "websocket", type: event.type }));
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

type SupabaseSignalingEnvelope = {
  message: PAPClientMessage | PAPServerMessage;
};

let supabaseBrowserClient: SupabaseClient | null = null;

function hasSupabaseRealtimeConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

function getSupabaseBrowserClient() {
  if (supabaseBrowserClient) {
    return supabaseBrowserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase Realtime is not configured.");
  }

  supabaseBrowserClient = createClient(supabaseUrl, supabaseKey);
  return supabaseBrowserClient;
}

function connectSupabasePAPSignaling(params: PAPSignalingParams) {
  const supabase = getSupabaseBrowserClient();
  let channel = supabase.channel(`pap-staging-${createPAPPeerId("pending")}`, {
    config: {
      broadcast: { ack: false, self: false },
      private: false,
    },
  });
  let activeChannelName = "";
  let session: PAPSession | null = null;
  let ownPeerId = "";
  let subscribed = false;

  function publish(message: PAPClientMessage | PAPServerMessage) {
    if (!subscribed) return;
    void channel.send({
      type: "broadcast",
      event: "pap-message",
      payload: { message } satisfies SupabaseSignalingEnvelope,
    });
  }

  function subscribeToChannel(channelName: string, onSubscribed?: () => void) {
    if (activeChannelName === channelName && subscribed) {
      onSubscribed?.();
      return;
    }

    if (subscribed || activeChannelName) {
      void supabase.removeChannel(channel);
    }

    activeChannelName = channelName;
    subscribed = false;
    channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
        private: false,
      },
    });

    channel
      .on("broadcast", { event: "pap-message" }, (payload) => {
        const incoming = (payload.payload as SupabaseSignalingEnvelope | undefined)?.message;
        if (!incoming) return;
        handleIncomingMessage(incoming);
      })
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          onSubscribed?.();
          return;
        }

        if (status === "CLOSED") {
          subscribed = false;
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribed = false;
          params.onError?.({
            transport: "supabase-realtime",
            status,
            channelName,
            hasSession: Boolean(session),
            sessionId: session?.id,
            pairingCode: session?.pairingCode,
            error: serializeSupabaseRealtimeError(error),
          });
        }
      });
  }

  function handleIncomingMessage(message: PAPClientMessage | PAPServerMessage) {
    if (message.type === "join-session") {
      if (!session || message.pairingCode !== session.pairingCode || message.peerId === ownPeerId) return;

      session = {
        ...session,
        mobilePeerId: message.peerId,
        mobileDeviceName: message.deviceName,
        status: "connected",
      };

      params.onMessage({
        type: "peer-joined",
        session,
        peerId: message.peerId,
        deviceName: message.deviceName,
      });
      publish({ type: "session-joined", session });
      return;
    }

    if (message.type === "leave-session") {
      if (!session || message.sessionId !== session.id || message.peerId === ownPeerId) return;
      params.onMessage({ type: "peer-left", sessionId: message.sessionId, peerId: message.peerId });
      return;
    }

    if (message.type === "signal") {
      if (!session || message.sessionId !== session.id || message.fromPeerId === ownPeerId) return;
      params.onMessage(message);
      return;
    }

    if (
      message.type === "session-joined" ||
      message.type === "peer-joined" ||
      message.type === "peer-left" ||
      message.type === "session-expired" ||
      message.type === "error"
    ) {
      params.onMessage(message);
    }
  }

  queueMicrotask(() => params.onOpen?.());

  return {
    send(message: PAPClientMessage) {
      if (message.type === "create-session") {
        ownPeerId = message.peerId;
        session = createLocalPAPSession(message.peerId, message.deviceName);
        subscribeToChannel(getPAPChannelName(session.pairingCode), () => {
          params.onMessage({ type: "session-created", session: session as PAPSession });
        });
        return;
      }

      if (message.type === "join-session") {
        ownPeerId = message.peerId;
        subscribeToChannel(getPAPChannelName(message.pairingCode), () => {
          publish(message);
        });
        return;
      }

      publish(message);
    },
    close() {
      subscribed = false;
      void supabase.removeChannel(channel);
      params.onClose?.();
    },
  };
}

type APISignalingResponse = {
  cursor: string;
  messages: Array<{
    id: string;
    message: PAPClientMessage | PAPServerMessage;
  }>;
};

function connectAPIPAPSignaling(params: PAPSignalingParams) {
  let session: PAPSession | null = null;
  let ownPeerId = "";
  let activePairingCode = "";
  let cursor = "0";
  let closed = false;
  let pollTimeout: ReturnType<typeof setTimeout> | null = null;

  function getEndpoint(pairingCode: string) {
    return `/api/pap/signaling/${encodeURIComponent(pairingCode)}`;
  }

  function schedulePoll(delayMs = 0) {
    if (closed || !activePairingCode || !ownPeerId) return;
    if (pollTimeout) {
      clearTimeout(pollTimeout);
    }

    pollTimeout = setTimeout(() => {
      void poll();
    }, delayMs);
  }

  async function poll() {
    if (closed || !activePairingCode || !ownPeerId) return;

    try {
      const response = await fetch(`${getEndpoint(activePairingCode)}?peerId=${encodeURIComponent(ownPeerId)}&cursor=${encodeURIComponent(cursor)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        params.onError?.({
          transport: "api-polling",
          status: response.status,
          pairingCode: activePairingCode,
          sessionId: session?.id,
        });
        schedulePoll(1_500);
        return;
      }

      const result = (await response.json()) as APISignalingResponse;
      cursor = result.cursor;
      for (const item of result.messages) {
        handleIncomingMessage(item.message);
      }
      schedulePoll(650);
    } catch (error: unknown) {
      params.onError?.({
        transport: "api-polling",
        pairingCode: activePairingCode,
        sessionId: session?.id,
        error: serializeSupabaseRealtimeError(error),
      });
      schedulePoll(1_500);
    }
  }

  async function publish(message: PAPClientMessage | PAPServerMessage) {
    if (closed || !activePairingCode || !ownPeerId) return;

    try {
      const response = await fetch(getEndpoint(activePairingCode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          peerId: ownPeerId,
          message,
        }),
        keepalive: message.type === "leave-session",
      });

      if (!response.ok) {
        params.onError?.({
          transport: "api-polling",
          status: response.status,
          pairingCode: activePairingCode,
          sessionId: session?.id,
        });
      }
    } catch (error: unknown) {
      params.onError?.({
        transport: "api-polling",
        pairingCode: activePairingCode,
        sessionId: session?.id,
        error: serializeSupabaseRealtimeError(error),
      });
    }
  }

  function handleIncomingMessage(message: PAPClientMessage | PAPServerMessage) {
    if (message.type === "join-session") {
      if (!session || message.pairingCode !== session.pairingCode || message.peerId === ownPeerId) return;

      session = {
        ...session,
        mobilePeerId: message.peerId,
        mobileDeviceName: message.deviceName,
        status: "connected",
      };

      params.onMessage({
        type: "peer-joined",
        session,
        peerId: message.peerId,
        deviceName: message.deviceName,
      });
      void publish({ type: "session-joined", session });
      return;
    }

    if (message.type === "leave-session") {
      if (!session || message.sessionId !== session.id || message.peerId === ownPeerId) return;
      params.onMessage({ type: "peer-left", sessionId: message.sessionId, peerId: message.peerId });
      return;
    }

    if (message.type === "signal") {
      if (!session || message.sessionId !== session.id || message.fromPeerId === ownPeerId) return;
      params.onMessage(message);
      return;
    }

    if (message.type === "session-joined") {
      if (message.session.pairingCode !== activePairingCode) return;
      session = message.session;
      params.onMessage(message);
      return;
    }

    if (
      message.type === "peer-joined" ||
      message.type === "peer-left" ||
      message.type === "session-expired" ||
      message.type === "error"
    ) {
      params.onMessage(message);
    }
  }

  queueMicrotask(() => params.onOpen?.());

  return {
    send(message: PAPClientMessage) {
      if (message.type === "create-session") {
        ownPeerId = message.peerId;
        session = createLocalPAPSession(message.peerId, message.deviceName);
        activePairingCode = session.pairingCode;
        cursor = "0";
        params.onMessage({ type: "session-created", session });
        schedulePoll();
        return;
      }

      if (message.type === "join-session") {
        ownPeerId = message.peerId;
        activePairingCode = message.pairingCode;
        cursor = "0";
        schedulePoll();
        void publish(message);
        return;
      }

      void publish(message);
    },
    close() {
      closed = true;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
      params.onClose?.();
    },
  };
}

function createLocalPAPSession(desktopPeerId: string, desktopDeviceName: string): PAPSession {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PAP_SESSION_TTL_MS);

  return {
    id: createPAPPeerId("session"),
    pairingCode: createPairingCode(),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    desktopPeerId,
    desktopDeviceName,
    status: "waiting",
  };
}

function createPairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getPAPChannelName(pairingCode: string) {
  return `pap-${pairingCode}`;
}

function serializeSupabaseRealtimeError(error: unknown) {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause,
    };
  }

  return error;
}
