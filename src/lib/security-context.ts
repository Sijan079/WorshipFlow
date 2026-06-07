import type { Prisma, PrismaClient } from "@prisma/client";

export const DEFAULT_WORKSPACE_SLUG = "default";

type WorkspaceEnvironment = {
  WORSHIP_WORKSPACE_SLUG?: string;
};
type WorkspaceClient = Pick<PrismaClient, "workspace"> | Prisma.TransactionClient;

export function getDefaultWorkspaceSlug(env: WorkspaceEnvironment = process.env as WorkspaceEnvironment) {
  const slug = env.WORSHIP_WORKSPACE_SLUG?.trim();
  return slug || DEFAULT_WORKSPACE_SLUG;
}

export async function getActiveWorkspaceId(client: WorkspaceClient) {
  const slug = getDefaultWorkspaceSlug();
  const workspace = await client.workspace.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: slug === DEFAULT_WORKSPACE_SLUG ? "Default Workspace" : slug,
    },
    select: { id: true },
  });

  return workspace.id;
}

export function serviceWorkspaceWhere(id: string, workspaceId: string) {
  return { id, workspaceId };
}
