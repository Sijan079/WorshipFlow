import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "./prisma.ts";
import { createClient as createSupabaseServerClient } from "./supabase/server.ts";
import {
  type WorkspaceContext,
  type WorkspaceRole,
} from "./workspace-auth.ts";
import { DEFAULT_WORKSPACE_SLUG, getDefaultWorkspaceSlug } from "./workspace-context-helpers.ts";

export { DEFAULT_WORKSPACE_SLUG, getDefaultWorkspaceSlug } from "./workspace-context-helpers.ts";

type WorkspaceClient = Pick<PrismaClient, "workspace"> | Prisma.TransactionClient;

export class WorkspaceAuthorizationError extends Error {
  readonly status: 400 | 401 | 403 | 404;

  constructor(status: 400 | 401 | 403 | 404, message: string) {
    super(message);
    this.status = status;
    this.name = "WorkspaceAuthorizationError";
  }
}

export async function getActiveWorkspaceId(client: WorkspaceClient) {
  let slug = getDefaultWorkspaceSlug();
  let requestMethod = "GET";
  let requestWorkspaceScoped = false;
  try {
    const { headers } = await import("next/headers");
    const requestHeaders = await headers();
    const requestSlug = requestHeaders.get("x-worship-workspace-slug")?.trim();
    requestWorkspaceScoped = Boolean(requestSlug);
    slug = requestSlug || slug;
    requestMethod = requestHeaders.get("x-worship-workspace-method") || requestMethod;
  } catch {
    // Internal jobs and tests run without a request context.
  }

  const workspace = requestWorkspaceScoped
    ? await client.workspace.findUnique({ where: { slug }, select: { id: true } })
    : await client.workspace.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          name: slug === DEFAULT_WORKSPACE_SLUG ? "Default Workspace" : slug,
        },
        select: { id: true },
      });

  if (!workspace) {
    throw new WorkspaceAuthorizationError(404, "Workspace not found.");
  }

  if (requestWorkspaceScoped) {
    const user = await requireAuthenticatedUser();
    const membership = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new WorkspaceAuthorizationError(403, "You do not have access to this workspace.");
    }
    if (requestMethod !== "GET" && requestMethod !== "HEAD" && membership.role === "MEMBER") {
      throw new WorkspaceAuthorizationError(403, "You do not have permission for this workspace action.");
    }
  }

  return workspace.id;
}

export function serviceWorkspaceWhere(id: string, workspaceId: string) {
  return { id, workspaceId };
}

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || !data.user.email) {
    throw new WorkspaceAuthorizationError(401, "Authentication required.");
  }

  const email = data.user.email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { authProviderId: data.user.id },
    update: {
      email,
      displayName: data.user.user_metadata?.display_name || data.user.user_metadata?.full_name || null,
    },
    create: {
      authProviderId: data.user.id,
      email,
      displayName: data.user.user_metadata?.display_name || data.user.user_metadata?.full_name || null,
    },
  });

  return user;
}

export async function requireWorkspaceContext(workspaceSlug: string): Promise<WorkspaceContext> {
  const user = await requireAuthenticatedUser();
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });

  if (!workspace) {
    throw new WorkspaceAuthorizationError(404, "Workspace not found.");
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new WorkspaceAuthorizationError(403, "You do not have access to this workspace.");
  }

  return {
    userId: user.id,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    membershipId: membership.id,
    role: membership.role,
  };
}

const ROLE_RANK: Record<WorkspaceRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export async function requireWorkspaceRole(workspaceSlug: string, minimumRole: WorkspaceRole) {
  const context = await requireWorkspaceContext(workspaceSlug);

  if (ROLE_RANK[context.role] < ROLE_RANK[minimumRole]) {
    throw new WorkspaceAuthorizationError(403, "You do not have permission for this workspace action.");
  }

  return context;
}

export async function requireExplicitWorkspaceRole(minimumRole: WorkspaceRole) {
  const { headers } = await import("next/headers");
  const workspaceSlug = (await headers()).get("x-worship-workspace-slug")?.trim();
  if (!workspaceSlug) throw new WorkspaceAuthorizationError(400, "Workspace scope is required.");
  return requireWorkspaceRole(workspaceSlug, minimumRole);
}

export async function listUserWorkspaces() {
  const user = await requireAuthenticatedUser();
  return prisma.workspace.findMany({
    where: {
      memberships: {
        some: { userId: user.id, status: "ACTIVE" },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}
