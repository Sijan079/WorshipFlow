import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getErrorMessage } from "@/lib/errors";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";

const InvitationSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof WorkspaceAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: getErrorMessage(error, fallback) }, { status: 500 });
}

export async function GET() {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const invitations = await prisma.workspaceInvitation.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(invitations);
  } catch (error: unknown) {
    return errorResponse(error, "Failed to load invitations.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const parsed = InvitationSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existingUser) {
      const membership = await prisma.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: existingUser.id } },
      });
      if (membership) {
        return NextResponse.json({ error: "This email already belongs to the workspace." }, { status: 409 });
      }
    }

    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: { workspaceId: context.workspaceId, email: parsed.data.email, status: "PENDING" },
    });
    if (existingInvitation) {
      return NextResponse.json({ error: "A pending invitation already exists for this email." }, { status: 409 });
    }

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: context.workspaceId,
        email: parsed.data.email,
        role: parsed.data.role,
        invitedByUserId: context.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const origin = new URL(request.url).origin;
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?invitationId=${invitation.id}&workspace=${encodeURIComponent(context.workspaceSlug)}`,
    });

    if (error) {
      await prisma.workspaceInvitation.delete({ where: { id: invitation.id } });
      throw error;
    }

    return NextResponse.json({ id: invitation.id, status: invitation.status }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to send invitation.");
  }
}
