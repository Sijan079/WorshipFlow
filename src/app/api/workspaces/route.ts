import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/security-context";
import { seedChecklistPresets, seedMinistryPresets, seedServiceTemplatePresets, seedServantGroupPresets } from "@/lib/settings-server";
import { createWorkspaceSlug, WORKSPACE_NAME_MAX_LENGTH, WORKSPACE_NAME_MIN_LENGTH } from "@/lib/workspace-slug";

const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(WORKSPACE_NAME_MIN_LENGTH, "Church organization name is too short.").max(WORKSPACE_NAME_MAX_LENGTH, "Church organization name is too long."),
});

async function getAvailableSlug(name: string) {
  const baseSlug = createWorkspaceSlug(name);
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`.slice(0, 64).replace(/-+$/g, "");
    suffix += 1;
  }

  return slug;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = CreateWorkspaceSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid workspace." }, { status: 400 });
    }

    const slug = await getAvailableSlug(parsed.data.name);
    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name: parsed.data.name,
          slug,
        },
        select: { id: true, name: true, slug: true },
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: created.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });

      await seedMinistryPresets(tx, created.id);
      await seedServantGroupPresets(tx, created.id);
      await seedChecklistPresets(tx, created.id);
      await seedServiceTemplatePresets(tx, created.id);

      return created;
    });

    return NextResponse.json({
      workspace,
      membership: { role: "OWNER", status: "ACTIVE" },
    }, { status: 201 });
  } catch (error) {
    const status = error instanceof Error && error.name === "WorkspaceAuthorizationError" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Authentication required." : "Unable to create church organization." }, { status });
  }
}
