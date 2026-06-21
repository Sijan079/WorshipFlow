import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { UpdateWorshipServiceSchema } from "@/lib/validation";
import { serviceDetailInclude } from "@/lib/service-data";
import { getActiveWorkspaceId, serviceWorkspaceWhere } from "@/lib/security-context";
import {
  mapAssignedMinistryToLegacyMinistryName,
  mapTemplateTypeToServiceVariant,
  type AssignedMinistry,
  type PledgeType,
  type ServiceHymnalRole,
  type ServiceServantRole,
  type ServiceTemplateType,
} from "@/lib/service-records";

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

    const updatedService = await prisma.$transaction(async (tx) => {
      const nextAssignedMinistry = (result.data.assignedMinistry ?? service.assignedMinistry ?? "MIXED") as AssignedMinistry;
      const nextTemplateType = (result.data.templateType ?? service.templateType) as ServiceTemplateType;
      const data: Prisma.WorshipServiceUpdateInput = {
        serviceDate: result.data.serviceDate,
        assignedMinistry: result.data.assignedMinistry as AssignedMinistry | undefined,
        sermonVerse: result.data.sermonVerse,
        ministryName: mapAssignedMinistryToLegacyMinistryName(nextAssignedMinistry),
        serviceVariant: mapTemplateTypeToServiceVariant(nextTemplateType) as "STANDARD" | "EXTENDED",
        status: result.data.status,
        templateType: result.data.templateType as ServiceTemplateType | undefined,
        pledgeType: result.data.pledgeType as PledgeType | null | undefined,
      };

      await tx.worshipService.update({
        where: serviceWorkspaceWhere(id, workspaceId),
        data,
      });

      if (result.data.bibleVerses) {
        await tx.serviceBibleVerse.deleteMany({ where: { serviceId: id } });
        if (result.data.bibleVerses.length > 0) {
          await tx.serviceBibleVerse.createMany({
            data: result.data.bibleVerses.map((entry) => ({
              serviceId: id,
              verse: entry.verse,
              order: entry.order,
            })),
          });
        }
      }

      if (result.data.servantAssignments) {
        await tx.serviceServantAssignment.deleteMany({ where: { serviceId: id } });
        if (result.data.servantAssignments.length > 0) {
          await tx.serviceServantAssignment.createMany({
            data: result.data.servantAssignments.map((entry) => ({
              serviceId: id,
              role: entry.role as ServiceServantRole,
              personName: entry.personName,
            })),
          });
        }
      }

      if (result.data.hymnals) {
        await tx.serviceHymnal.deleteMany({ where: { serviceId: id } });
        if (result.data.hymnals.length > 0) {
          await tx.serviceHymnal.createMany({
            data: result.data.hymnals.map((entry) => ({
              serviceId: id,
              role: entry.role as ServiceHymnalRole,
              title: entry.title,
            })),
          });
        }
      }

      return tx.worshipService.findUnique({
        where: serviceWorkspaceWhere(id, workspaceId),
        include: serviceDetailInclude,
      });
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
