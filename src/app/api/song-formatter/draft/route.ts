import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import { DraftRequestSchema } from "@/features/song-formatter/draft-contract";
import { changeFormatterDraft, DraftError, getFormatterDraft } from "@/features/song-formatter/draft-store";
import { reportServerFailure } from "@/lib/observability";

const ROUTE = "/api/song-formatter/draft";

function failure(error: unknown, request: Request) {
  const status = error instanceof DraftError || error instanceof WorkspaceAuthorizationError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
  reportServerFailure(error, {
    event: "song_formatter.draft.failure",
    route: ROUTE,
    method: request.method,
    status,
    requestId: request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id"),
    source: "route-handler",
  });
  return NextResponse.json({ error: status === 500 ? "Draft storage is unavailable. Please retry." : error instanceof Error ? error.message : "Invalid request." }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request) {
  try { return NextResponse.json(await getFormatterDraft(await requireExplicitWorkspaceRole("MEMBER")), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error, request); }
}
export async function POST(request: Request) {
  try {
    const scope = await requireExplicitWorkspaceRole("ADMIN");
    // JSON lyrics have an explicit bound, including multibyte encoding/escaping.
    const reader = request.body?.getReader();
    if (!reader) throw new DraftError("A request body is required.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 6_100_000) { await reader.cancel(); throw new DraftError("Draft is too large.", 413); }
      chunks.push(part.value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    const command = DraftRequestSchema.parse(JSON.parse(raw));
    return NextResponse.json(await changeFormatterDraft(scope, command), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error, request); }
}
