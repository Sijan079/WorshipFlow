import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { isPAPDatabaseUnavailableError, papDatabaseUnavailableResponse } from "@/features/pap/server/pap-api-errors";
import {
  cleanupExpiredPAPRooms,
  createPAPRoomToken,
  getPAPJoinBaseUrl,
  hashPAPRoomToken,
  type PAPRoomRow,
  PAP_ROOM_TTL_MS,
} from "@/features/pap/server/pap-room-security";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await cleanupExpiredPAPRooms();

    const token = createPAPRoomToken();
    const expiresAt = new Date(Date.now() + PAP_ROOM_TTL_MS);
    const [room] = await prisma.$queryRaw<PAPRoomRow[]>`
      INSERT INTO "PAPTransferRoom" ("id", "tokenHash", "expiresAt")
      VALUES (${randomUUID()}, ${hashPAPRoomToken(token)}, ${expiresAt})
      RETURNING "id", "tokenHash", "createdAt", "expiresAt", "revokedAt"
    `;

    if (!room) {
      throw new Error("PAP room was not created.");
    }

    return NextResponse.json(
      {
        room: {
          id: room.id,
          expiresAt: room.expiresAt.toISOString(),
          createdAt: room.createdAt.toISOString(),
        },
        token,
        joinUrl: `${getPAPJoinBaseUrl()}/pap/join/${token}`,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("POST /api/pap/rooms error:", error);
    if (isPAPDatabaseUnavailableError(error)) {
      return papDatabaseUnavailableResponse();
    }

    return NextResponse.json({ error: "Failed to create PAP room." }, { status: 500 });
  }
}
