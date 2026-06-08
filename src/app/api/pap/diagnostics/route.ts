import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PAPDiagnosticSchema = z.object({
  event: z.enum(["signaling-error", "signaling-closed", "session-error", "webrtc-failed", "webrtc-disconnected"]),
  role: z.enum(["desktop", "mobile"]),
  pairingCode: z.string().optional(),
  sessionId: z.string().optional(),
  peerId: z.string().optional(),
  state: z.string().optional(),
  message: z.string().optional(),
  detail: z.unknown().optional(),
  href: z.string().optional(),
  origin: z.string().optional(),
  userAgent: z.string().optional(),
  signalingMode: z.string().optional(),
  signalingTarget: z.string().optional(),
  hasSupabaseUrl: z.boolean().optional(),
  hasSupabasePublishableKey: z.boolean().optional(),
  hasPAPSignalingUrl: z.boolean().optional(),
  occurredAt: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = PAPDiagnosticSchema.safeParse(body);

    if (!result.success) {
      console.warn("POST /api/pap/diagnostics invalid payload:", result.error.flatten());
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const userAgent = request.headers.get("user-agent");

    console.error("PAP client diagnostic:", {
      ...result.data,
      request: {
        forwardedFor,
        userAgent,
        vercelId: request.headers.get("x-vercel-id"),
      },
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("POST /api/pap/diagnostics error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
