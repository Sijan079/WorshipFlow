import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError, requireExplicitWorkspaceRole } from "@/lib/security-context";
import { formatPersonDisplayName } from "@/features/people/people-format";
import { comparePeople } from "@/features/people/person-validation";

// Names only, for choosing someone on a service. Any member of the workspace can read it, so
// building a service never needs access to the People directory. It returns nothing beyond a
// display name, and leaves out people who have left.
export async function GET(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const rows = await prisma.person.findMany({
      where: { workspaceId: context.workspaceId, status: { notIn: ["ARCHIVED", "INACTIVE"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        ministries: { select: { ministry: { select: { code: true } } } },
      },
    });
    const people = rows
      .sort(comparePeople)
      .map((row) => ({
        id: row.id,
        name: formatPersonDisplayName({
          firstName: row.firstName,
          lastName: row.lastName,
          gender: row.gender,
          ministryCodes: row.ministries.map((link) => link.ministry.code),
        }),
      }));
    return NextResponse.json(people);
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/people/names", method: "GET", status, request });
    return NextResponse.json({ error: status === 500 ? "Failed to load people." : (error as Error).message }, { status });
  }
}
