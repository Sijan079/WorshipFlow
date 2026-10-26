import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError, requireExplicitWorkspaceRole } from "@/lib/security-context";

// The ministry choices for a service. Any member who builds services can read them, so this
// does not need access to the People directory. It lists active ministries for the caller's
// workspace, including service-only ones such as Mixed, and nothing about their members.
export async function GET(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const ministries = await prisma.ministry.findMany({
      where: { workspaceId: context.workspaceId, active: true },
      select: { id: true, code: true, label: true, serviceOnly: true },
      orderBy: { label: "asc" },
    });
    return NextResponse.json(ministries);
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/ministries/options", method: "GET", status, request });
    return NextResponse.json({ error: status === 500 ? "Failed to load ministries." : (error as Error).message }, { status });
  }
}
