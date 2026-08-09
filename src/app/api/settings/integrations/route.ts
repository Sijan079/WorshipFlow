import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getServerEnv } from "@/lib/server-env";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";
import { encryptIntegrationSecret, toSafeIntegrationRecord } from "@/lib/workspace-integrations";

const IntegrationSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI"]),
  enabled: z.boolean().default(true),
  apiKey: z.string().trim().max(500).optional(),
  extractorModel: z.string().trim().max(120).nullable().optional(),
  backgroundImageModel: z.string().trim().max(120).nullable().optional(),
  backgroundVideoModel: z.string().trim().max(120).nullable().optional(),
});

function encryptionKey() {
  const key = getServerEnv().WORKSPACE_INTEGRATION_ENCRYPTION_KEY;
  if (!key) throw new Error("Workspace integration encryption is not configured.");
  return key;
}

export async function GET() {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const records = await prisma.workspaceIntegration.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { provider: "asc" } });
    return NextResponse.json(records.map(toSafeIntegrationRecord));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load integrations") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const parsed = IntegrationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    const data = {
      enabled: parsed.data.enabled,
      ...(parsed.data.apiKey ? { apiKeyCiphertext: encryptIntegrationSecret(parsed.data.apiKey, encryptionKey()) } : {}),
      extractorModel: parsed.data.extractorModel ?? null,
      backgroundImageModel: parsed.data.backgroundImageModel ?? null,
      backgroundVideoModel: parsed.data.backgroundVideoModel ?? null,
    };
    const record = await prisma.workspaceIntegration.upsert({
      where: { workspaceId_provider: { workspaceId: context.workspaceId, provider: parsed.data.provider } },
      create: { workspaceId: context.workspaceId, provider: parsed.data.provider, ...data },
      update: data,
    });
    return NextResponse.json(toSafeIntegrationRecord(record));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to save integration") }, { status: 500 });
  }
}
