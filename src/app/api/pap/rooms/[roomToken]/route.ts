import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isPAPDatabaseUnavailableError, papDatabaseUnavailableResponse } from "@/features/pap/server/pap-api-errors";
import { getActivePAPRoomByToken, hashPAPRoomToken, validatePAPRoomToken } from "@/features/pap/server/pap-room-security";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ roomToken: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { roomToken } = await context.params;
    const room = await getActivePAPRoomByToken(roomToken);
    if (!room) {
      return NextResponse.json({ error: "PAP room is missing or expired." }, { status: 404 });
    }

    return NextResponse.json(
      {
        room: {
          id: room.id,
          createdAt: room.createdAt.toISOString(),
          expiresAt: room.expiresAt.toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/pap/rooms/[roomToken] error:", error);
    if (isPAPDatabaseUnavailableError(error)) {
      return papDatabaseUnavailableResponse();
    }

    return NextResponse.json({ error: "Failed to load PAP room." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { roomToken } = await context.params;
    if (!validatePAPRoomToken(roomToken)) {
      return NextResponse.json({ error: "Invalid PAP room token." }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE "PAPTransferRoom"
      SET "revokedAt" = ${new Date()}
      WHERE "tokenHash" = ${hashPAPRoomToken(roomToken)}
        AND "revokedAt" IS NULL
    `;

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("DELETE /api/pap/rooms/[roomToken] error:", error);
    if (isPAPDatabaseUnavailableError(error)) {
      return papDatabaseUnavailableResponse();
    }

    return NextResponse.json({ error: "Failed to revoke PAP room." }, { status: 500 });
  }
}
