import { randomUUID } from "crypto";
import { PAP_SESSION_TTL_MS, type PAPSession } from "../types";

type StoredSession = PAPSession & {
  desktopSocketId?: string;
  mobileSocketId?: string;
};

export class PAPSessionStore {
  private sessions = new Map<string, StoredSession>();

  createSession(input: { desktopPeerId: string; desktopDeviceName: string; now?: Date }) {
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + PAP_SESSION_TTL_MS);
    const session: StoredSession = {
      id: randomUUID(),
      pairingCode: this.createUniquePairingCode(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      desktopPeerId: input.desktopPeerId,
      desktopDeviceName: input.desktopDeviceName,
      status: "waiting",
    };

    this.sessions.set(session.id, session);
    return this.toPublicSession(session);
  }

  setDesktopSocket(sessionId: string, socketId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.desktopSocketId = socketId;
  }

  setMobileSocket(sessionId: string, socketId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.mobileSocketId = socketId;
  }

  joinSession(input: { pairingCode: string; mobilePeerId: string; mobileDeviceName: string }) {
    const session = this.findByPairingCode(input.pairingCode);
    if (!session || this.isExpired(session)) {
      return null;
    }

    session.mobilePeerId = input.mobilePeerId;
    session.mobileDeviceName = input.mobileDeviceName;
    session.status = "connected";
    return this.toPublicSession(session);
  }

  findById(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session)) return null;
    return session;
  }

  findByPairingCode(pairingCode: string) {
    for (const session of this.sessions.values()) {
      if (session.pairingCode === pairingCode) {
        return session;
      }
    }
    return null;
  }

  findBySocketId(socketId: string) {
    return Array.from(this.sessions.values()).filter(
      (session) => session.desktopSocketId === socketId || session.mobileSocketId === socketId
    );
  }

  leave(sessionId: string, peerId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.mobilePeerId === peerId) {
      session.mobilePeerId = undefined;
      session.mobileDeviceName = undefined;
      session.mobileSocketId = undefined;
      session.status = "waiting";
    }

    if (session.desktopPeerId === peerId) {
      this.sessions.delete(sessionId);
      return null;
    }

    return this.toPublicSession(session);
  }

  cleanupExpired(now = new Date()) {
    const expired: PAPSession[] = [];
    for (const session of this.sessions.values()) {
      if (new Date(session.expiresAt).getTime() <= now.getTime()) {
        session.status = "expired";
        expired.push(this.toPublicSession(session));
        this.sessions.delete(session.id);
      }
    }
    return expired;
  }

  private createUniquePairingCode() {
    let code = "";
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
    } while (this.findByPairingCode(code));
    return code;
  }

  private isExpired(session: StoredSession) {
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      session.status = "expired";
      this.sessions.delete(session.id);
      return true;
    }
    return false;
  }

  private toPublicSession(session: StoredSession): PAPSession {
    return {
      id: session.id,
      pairingCode: session.pairingCode,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      desktopPeerId: session.desktopPeerId,
      mobilePeerId: session.mobilePeerId,
      desktopDeviceName: session.desktopDeviceName,
      mobileDeviceName: session.mobileDeviceName,
      status: session.status,
    };
  }
}
