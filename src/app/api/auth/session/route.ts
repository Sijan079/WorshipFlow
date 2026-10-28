import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportRouteFailure } from "@/lib/observability";
import { requireWorkspaceContext, WorkspaceAuthorizationError } from "@/lib/security-context";
import { hasModuleAction } from "@/lib/event-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug")?.trim();
  const googleIdentity = data.user?.identities?.find((identity) => identity.provider === "google")?.identity_data;
  const displayName = data.user?.user_metadata?.display_name || data.user?.user_metadata?.full_name || googleIdentity?.full_name || googleIdentity?.name || null;
  const avatarUrl = data.user?.user_metadata?.avatar_url || data.user?.user_metadata?.picture || googleIdentity?.avatar_url || googleIdentity?.picture || null;
  let role: string | null = null;
  let canViewEvents = false;
  let canViewCaptions = false;
  let canViewPeople = false;
  let canViewAnnouncements = false;
  if (data.user && workspaceSlug) {
    try {
      const context = await requireWorkspaceContext(workspaceSlug);
      role = context.role;
      [canViewEvents, canViewCaptions, canViewPeople, canViewAnnouncements] = await Promise.all([
        hasModuleAction(context, "EVENTS", "VIEW"),
        hasModuleAction(context, "CAPTIONS", "VIEW"),
        hasModuleAction(context, "PEOPLE", "VIEW"),
        hasModuleAction(context, "ANNOUNCEMENTS", "VIEW"),
      ]);
    } catch (error) {
      if (!(error instanceof WorkspaceAuthorizationError)) {
        reportRouteFailure(error, {
          route: "/api/auth/session",
          method: "GET",
          status: 500,
          request,
        });
      }
      role = null;
    }
  }
  return NextResponse.json({
    authenticated: Boolean(data.user),
    user: data.user ? {
      id: data.user.id,
      email: data.user.email,
      displayName,
      avatarUrl,
      role,
      canViewEvents,
      canViewCaptions,
      canViewPeople,
      canViewAnnouncements,
    } : null,
  });
}
