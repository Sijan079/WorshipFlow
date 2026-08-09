import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/workspaces";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const invitationId = url.searchParams.get("invitationId");
  const nextPath = getSafeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_auth_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url.origin));
  }

  const { data: userData } = await supabase.auth.getUser();
  const authUser = userData.user;

  if (invitationId && authUser?.email) {
    const invitation = await prisma.workspaceInvitation.findUnique({ where: { id: invitationId } });
    const emailMatches = invitation?.email === authUser.email.trim().toLowerCase();
    const validInvitation = invitation
      && invitation.status === "PENDING"
      && invitation.expiresAt > new Date()
      && emailMatches;

    if (!validInvitation) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=invalid_invitation", url.origin));
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { authProviderId: authUser.id },
        update: { email: invitation.email, displayName: authUser.user_metadata?.full_name ?? null },
        create: {
          authProviderId: authUser.id,
          email: invitation.email,
          displayName: authUser.user_metadata?.full_name ?? null,
        },
      });

      await tx.workspaceMembership.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
        update: { role: invitation.role, status: "ACTIVE" },
        create: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
          status: "ACTIVE",
        },
      });

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    });

    return NextResponse.redirect(new URL(`/w/${encodeURIComponent(url.searchParams.get("workspace") ?? "")}/dashboard`, url.origin));
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
