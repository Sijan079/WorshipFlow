import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceContext } from "@/lib/security-context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug")?.trim();
  const googleIdentity = data.user?.identities?.find((identity) => identity.provider === "google")?.identity_data;
  const displayName = data.user?.user_metadata?.display_name || data.user?.user_metadata?.full_name || googleIdentity?.full_name || googleIdentity?.name || null;
  const avatarUrl = data.user?.user_metadata?.avatar_url || data.user?.user_metadata?.picture || googleIdentity?.avatar_url || googleIdentity?.picture || null;
  let role: string | null = null;
  if (data.user && workspaceSlug) {
    try {
      role = (await requireWorkspaceContext(workspaceSlug)).role;
    } catch {
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
    } : null,
  });
}
