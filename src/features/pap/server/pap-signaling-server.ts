import { WebSocketServer, type WebSocket } from "ws";
import { randomUUID } from "crypto";
import { PAPSessionStore } from "../session/pap-session-store";
import type { PAPClientMessage, PAPServerMessage } from "../types";

const port = Number(process.env.PAP_SIGNALING_PORT ?? 3001);
const store = new PAPSessionStore();
const peers = new Map<string, WebSocket>();

function send(socket: WebSocket, message: PAPServerMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function sendToSocketId(socketId: string | undefined, message: PAPServerMessage) {
  if (!socketId) return;
  const peerSocket = peers.get(socketId);
  if (peerSocket) {
    send(peerSocket, message);
  }
}

function parseMessage(rawMessage: WebSocket.RawData): PAPClientMessage | null {
  try {
    const text = typeof rawMessage === "string" ? rawMessage : rawMessage.toString("utf8");
    return JSON.parse(text) as PAPClientMessage;
  } catch {
    return null;
  }
}

const wss = new WebSocketServer({ port });

wss.on("connection", (socket) => {
  const socketId = randomUUID();
  peers.set(socketId, socket);

  socket.on("message", (rawMessage) => {
    const message = parseMessage(rawMessage);
    if (!message) {
      send(socket, { type: "error", message: "Invalid signaling message." });
      return;
    }

    if (message.type === "create-session") {
      const session = store.createSession({
        desktopPeerId: message.peerId,
        desktopDeviceName: message.deviceName,
      });
      store.setDesktopSocket(session.id, socketId);
      send(socket, { type: "session-created", session });
      return;
    }

    if (message.type === "join-session") {
      const session = store.joinSession({
        pairingCode: message.pairingCode,
        mobilePeerId: message.peerId,
        mobileDeviceName: message.deviceName,
      });

      if (!session) {
        send(socket, { type: "error", message: "PAP session is missing or expired." });
        return;
      }

      store.setMobileSocket(session.id, socketId);
      send(socket, { type: "session-joined", session });
      const storedSession = store.findById(session.id);
      sendToSocketId(storedSession?.desktopSocketId, {
        type: "peer-joined",
        session,
        peerId: message.peerId,
        deviceName: message.deviceName,
      });
      return;
    }

    if (message.type === "signal") {
      const session = store.findById(message.sessionId);
      if (!session) {
        send(socket, { type: "error", message: "PAP session is missing or expired." });
        return;
      }

      const targetSocketId =
        message.fromPeerId === session.desktopPeerId ? session.mobileSocketId : session.desktopSocketId;
      sendToSocketId(targetSocketId, {
        type: "signal",
        sessionId: message.sessionId,
        fromPeerId: message.fromPeerId,
        payload: message.payload,
      });
      return;
    }

    if (message.type === "leave-session") {
      const previousSession = store.findById(message.sessionId);
      const session = store.leave(message.sessionId, message.peerId);
      if (previousSession) {
        const otherSocketId =
          previousSession.desktopPeerId === message.peerId
            ? previousSession.mobileSocketId
            : previousSession.desktopSocketId;
        sendToSocketId(otherSocketId, {
          type: "peer-left",
          sessionId: message.sessionId,
          peerId: message.peerId,
        });
      }
      if (session) {
        send(socket, { type: "session-created", session });
      }
    }
  });

  socket.on("close", () => {
    const sessions = store.findBySocketId(socketId);
    peers.delete(socketId);
    for (const session of sessions) {
      const peerId = session.desktopSocketId === socketId ? session.desktopPeerId : session.mobilePeerId;
      if (!peerId) continue;
      const updated = store.leave(session.id, peerId);
      const otherSocketId = session.desktopSocketId === socketId ? session.mobileSocketId : session.desktopSocketId;
      sendToSocketId(otherSocketId, { type: "peer-left", sessionId: session.id, peerId });
      if (updated && session.mobileSocketId === socketId) {
        sendToSocketId(session.desktopSocketId, { type: "session-created", session: updated });
      }
    }
  });
});

setInterval(() => {
  const expiredSessions = store.cleanupExpired();
  for (const session of expiredSessions) {
    for (const peerSocket of peers.values()) {
      send(peerSocket, { type: "session-expired", sessionId: session.id });
    }
  }
}, 10_000).unref();

console.log(`PAP signaling server listening on ws://localhost:${port}`);
