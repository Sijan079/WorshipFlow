import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hasModuleAction } from "@/lib/event-access";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { canPublishSite, requireSiteAction } from "@/features/site/site-access";
import { decideSettingsUpdate } from "@/features/site/settings/settings-rules";
import { UpdateSiteSettingsSchema } from "@/features/site/settings/settings-validation";

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/site/settings", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

const noStore = { "Cache-Control": "no-store" };
const settingsSelect = { contactEmail: true, contactPhone: true, address: true, indexable: true } as const;

export async function GET(request: Request) {
  try {
    const context = await requireSiteAction("VIEW");
    const [row, canEdit, canPublish] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { workspaceId: context.workspaceId }, select: settingsSelect }),
      hasModuleAction(context, "SITE", "EDIT"),
      canPublishSite(context),
    ]);
    return NextResponse.json({ settings: row ?? { contactEmail: null, contactPhone: null, address: null, indexable: false }, canEdit, canPublish }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "GET", "Failed to load the website settings.");
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireSiteAction("EDIT");
    const parsed = UpdateSiteSettingsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const existing = await prisma.siteSettings.findUnique({ where: { workspaceId: context.workspaceId }, select: { indexable: true } });
    const decision = decideSettingsUpdate({ existing: existing ?? { indexable: false }, input, canPublish: await canPublishSite(context) });
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 403 });

    const saved = await prisma.siteSettings.upsert({
      where: { workspaceId: context.workspaceId },
      create: { workspaceId: context.workspaceId, ...input },
      update: input,
      select: settingsSelect,
    });
    return NextResponse.json({ settings: saved }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "PATCH", "Failed to save the website settings.");
  }
}
