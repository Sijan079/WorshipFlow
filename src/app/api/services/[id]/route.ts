import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { UpdateWorshipServiceSchema } from "@/lib/validation";
import { serviceDetailInclude } from "@/lib/service-data";
import { getActiveWorkspaceId, serviceWorkspaceWhere } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  let serviceId = "";

  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    serviceId = id;
    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(id, workspaceId),
      include: serviceDetailInclude,
    });

    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    return NextResponse.json(service);
  } catch (error: unknown) {
    console.error(`GET /api/services/${serviceId || "[id]"} error:`, error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch service") }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  let serviceId = "";

  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    serviceId = id;
    const body = await request.json();
    const result = UpdateWorshipServiceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(id, workspaceId),
    });

    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const updatedService = await prisma.worshipService.update({
      where: serviceWorkspaceWhere(id, workspaceId),
      data: result.data,
      include: serviceDetailInclude,
    });

    return NextResponse.json(updatedService);
  } catch (error: unknown) {
    console.error(`PUT /api/services/${serviceId || "[id]"} error:`, error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update service") }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  let serviceId = "";

  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    serviceId = id;

    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(id, workspaceId),
    });

    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    await prisma.worshipService.delete({
      where: serviceWorkspaceWhere(id, workspaceId),
    });

    return NextResponse.json({ message: "Worship service deleted successfully" });
  } catch (error: unknown) {
    console.error(`DELETE /api/services/${serviceId || "[id]"} error:`, error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete service") }, { status: 500 });
  }
}
