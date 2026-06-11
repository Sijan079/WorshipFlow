import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { deletePrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";

export const PAP_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const PAP_ROOM_TOKEN_BYTES = 32;
export const PAP_ROOM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const PAP_UPLOAD_MAX_FILES = 12;
export const PAP_UPLOAD_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PAP_UPLOAD_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const PAP_UPLOAD_NOTE_MAX_LENGTH = 180;

export const PAP_IMAGE_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const PAP_IMAGE_UPLOAD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"] as const;

export type PAPRoomRow = {
  id: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

type PAPScreenshotPathRow = {
  id: string;
  filePath: string;
};

export async function ensurePAPRoomTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "PAPTransferRoom" (
      "id" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "revokedAt" TIMESTAMP(3),
      CONSTRAINT "PAPTransferRoom_pkey" PRIMARY KEY ("id")
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "PAPScreenshot" (
      "id" TEXT NOT NULL,
      "roomId" TEXT NOT NULL,
      "batchId" TEXT NOT NULL,
      "batchIndex" INTEGER NOT NULL,
      "batchTotal" INTEGER NOT NULL,
      "fileName" TEXT NOT NULL,
      "filePath" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "note" TEXT,
      "deviceName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PAPScreenshot_pkey" PRIMARY KEY ("id")
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "PAPTransferRoom_tokenHash_key"
    ON "PAPTransferRoom"("tokenHash")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "PAPTransferRoom_expiresAt_idx"
    ON "PAPTransferRoom"("expiresAt")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "PAPScreenshot_roomId_createdAt_idx"
    ON "PAPScreenshot"("roomId", "createdAt")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "PAPScreenshot_roomId_batchId_idx"
    ON "PAPScreenshot"("roomId", "batchId")
  `;
}

export function createPAPRoomToken() {
  return randomBytes(PAP_ROOM_TOKEN_BYTES).toString("base64url");
}

export function hashPAPRoomToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function validatePAPRoomToken(token: string) {
  return PAP_ROOM_TOKEN_PATTERN.test(token);
}

export async function cleanupExpiredPAPRooms(now = new Date()) {
  await ensurePAPRoomTables();
  await prisma.$executeRaw`
    DELETE FROM "PAPScreenshot"
    WHERE "roomId" IN (
      SELECT "id"
      FROM "PAPTransferRoom"
      WHERE "expiresAt" <= ${now}
    )
  `;

  await prisma.$executeRaw`
    DELETE FROM "PAPTransferRoom"
    WHERE "expiresAt" <= ${now}
  `;
}

export async function getOrCreatePAPGlobalInboxRoom() {
  await ensurePAPRoomTables();
  const globalRoomId = "global-temporary-inbox";
  const globalTokenHash = "global-temporary-inbox";
  const expiresAt = new Date("2999-12-31T00:00:00.000Z");

  const [room] = await prisma.$queryRaw<PAPRoomRow[]>`
    INSERT INTO "PAPTransferRoom" ("id", "tokenHash", "expiresAt")
    VALUES (${globalRoomId}, ${globalTokenHash}, ${expiresAt})
    ON CONFLICT ("id") DO UPDATE
    SET "expiresAt" = ${expiresAt},
        "revokedAt" = NULL
    RETURNING "id", "tokenHash", "createdAt", "expiresAt", "revokedAt"
  `;

  if (!room) {
    throw new Error("PAP global inbox room was not created.");
  }

  return room;
}

export async function cleanupExpiredPAPGlobalInboxUploads(now = new Date()) {
  await ensurePAPRoomTables();
  const room = await getOrCreatePAPGlobalInboxRoom();
  const expiresBefore = new Date(now.getTime() - PAP_ROOM_TTL_MS);
  const expired = await prisma.$queryRaw<PAPScreenshotPathRow[]>`
    SELECT "id", "filePath"
    FROM "PAPScreenshot"
    WHERE "roomId" = ${room.id}
      AND "createdAt" <= ${expiresBefore}
  `;

  if (expired.length === 0) {
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM "PAPScreenshot"
    WHERE "id" IN (${Prisma.join(expired.map((file) => file.id))})
  `;

  await Promise.all(expired.map((file) => deletePrivateOutputFile(file.filePath).catch(() => undefined)));
}

export async function getActivePAPRoomByToken(token: string) {
  if (!validatePAPRoomToken(token)) {
    return null;
  }

  await ensurePAPRoomTables();
  const now = new Date();
  const [room] = await prisma.$queryRaw<PAPRoomRow[]>`
    SELECT "id", "tokenHash", "createdAt", "expiresAt", "revokedAt"
    FROM "PAPTransferRoom"
    WHERE "tokenHash" = ${hashPAPRoomToken(token)}
    LIMIT 1
  `;

  if (!room || room.revokedAt || room.expiresAt <= now) {
    return null;
  }

  return room;
}

export function sanitizePAPFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "pap-screenshot";
}

export function getPAPJoinBaseUrl() {
  if (process.env.NEXT_PUBLIC_PAP_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_PAP_PUBLIC_URL.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
