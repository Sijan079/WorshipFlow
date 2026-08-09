import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";
import {
  ProgramBlockTypePayloadSchema,
  normalizeProgramBlockDefinition,
} from "@/lib/program-block-types";

export async function GET() {
  try {
    const workspaceId = (await requireExplicitWorkspaceRole("MEMBER")).workspaceId;
    const records = await prisma.programBlockType.findMany({
      where: { workspaceId },
      orderBy: [{ label: "asc" }],
      include: {
        versions: { orderBy: { version: "desc" } },
      },
    });
    return NextResponse.json(records);
  } catch (error: unknown) {
    console.error("GET /api/settings/program-block-types error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load program block types") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const parsed = ProgramBlockTypePayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const definition = normalizeProgramBlockDefinition(parsed.data.definition);
    const type = await prisma.programBlockType.create({
      data: {
        workspaceId,
        key: parsed.data.key,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        versions: {
          create: {
            version: 1,
            definition,
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        },
      },
      include: { versions: true },
    });
    return NextResponse.json(type, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/settings/program-block-types error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create program block type") }, { status: 500 });
  }
}
