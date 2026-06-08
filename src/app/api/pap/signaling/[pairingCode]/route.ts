import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PairingCodeSchema = z.string().regex(/^\d{6}$/);

const SignalingMessageSchema = z.object({
  peerId: z.string().min(1),
  message: z.unknown(),
});

const PAP_SIGNALING_TTL_MINUTES = 10;

type RouteContext = {
  params: Promise<{ pairingCode: string }>;
};

type SignalingRow = {
  id: bigint;
  message: unknown;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { pairingCode } = await context.params;
    const parsedPairingCode = PairingCodeSchema.safeParse(pairingCode);
    if (!parsedPairingCode.success) {
      return NextResponse.json({ error: "Invalid pairing code." }, { status: 400 });
    }

    const url = new URL(request.url);
    const peerId = url.searchParams.get("peerId");
    const cursor = Number(url.searchParams.get("cursor") ?? "0");

    if (!peerId) {
      return NextResponse.json({ error: "peerId is required." }, { status: 400 });
    }

    await ensurePAPSignalingTable();

    const rows = await prisma.$queryRaw<SignalingRow[]>`
      SELECT id, message
      FROM pap_signaling_messages
      WHERE pairing_code = ${parsedPairingCode.data}
        AND id > ${Number.isFinite(cursor) ? cursor : 0}
        AND sender_peer_id <> ${peerId}
      ORDER BY id ASC
      LIMIT 100
    `;

    return NextResponse.json(
      {
        cursor: rows.at(-1)?.id.toString() ?? String(Number.isFinite(cursor) ? cursor : 0),
        messages: rows.map((row) => ({
          id: row.id.toString(),
          message: row.message,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/pap/signaling/[pairingCode] error:", error);
    return NextResponse.json({ error: "Failed to poll PAP signaling messages." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { pairingCode } = await context.params;
    const parsedPairingCode = PairingCodeSchema.safeParse(pairingCode);
    if (!parsedPairingCode.success) {
      return NextResponse.json({ error: "Invalid pairing code." }, { status: 400 });
    }

    const body = await request.json();
    const result = SignalingMessageSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    await ensurePAPSignalingTable();
    await cleanupExpiredPAPSignalingMessages();

    const [row] = await prisma.$queryRaw<SignalingRow[]>`
      INSERT INTO pap_signaling_messages (pairing_code, sender_peer_id, message)
      VALUES (${parsedPairingCode.data}, ${result.data.peerId}, ${JSON.stringify(result.data.message)}::jsonb)
      RETURNING id, message
    `;

    return NextResponse.json(
      {
        id: row?.id.toString() ?? null,
        ok: true,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("POST /api/pap/signaling/[pairingCode] error:", error);
    return NextResponse.json({ error: "Failed to send PAP signaling message." }, { status: 500 });
  }
}

async function ensurePAPSignalingTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS pap_signaling_messages (
      id BIGSERIAL PRIMARY KEY,
      pairing_code TEXT NOT NULL,
      sender_peer_id TEXT NOT NULL,
      message JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS pap_signaling_messages_pairing_id_idx
    ON pap_signaling_messages (pairing_code, id)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS pap_signaling_messages_created_at_idx
    ON pap_signaling_messages (created_at)
  `;
}

async function cleanupExpiredPAPSignalingMessages() {
  await prisma.$executeRaw`
    DELETE FROM pap_signaling_messages
    WHERE created_at < NOW() - (${PAP_SIGNALING_TTL_MINUTES}::TEXT || ' minutes')::INTERVAL
  `;
}
