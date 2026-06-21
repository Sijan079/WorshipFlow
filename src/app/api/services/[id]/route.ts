import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
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

type UpdateWorshipServicePayload = z.infer<typeof UpdateWorshipServiceSchema>;

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
    const payload: UpdateWorshipServicePayload = result.data;

    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(id, workspaceId),
    });

    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const updatedService = await prisma.$transaction(async (tx) => {
      const nextAssignedMinistry = (payload.assignedMinistry ?? service.assignedMinistry ?? "MIXED") as AssignedMinistry;
      const nextTemplateType = (payload.templateType ?? service.templateType) as ServiceTemplateType;
      const data: Prisma.WorshipServiceUpdateInput = {
        serviceDate: payload.serviceDate,
        assignedMinistry: payload.assignedMinistry as AssignedMinistry | undefined,
        sermonVerse: payload.sermonVerse,
        ministryName: mapAssignedMinistryToLegacyMinistryName(nextAssignedMinistry),
        serviceVariant: mapTemplateTypeToServiceVariant(nextTemplateType) as "STANDARD" | "EXTENDED",
        status: payload.status,
        templateType: payload.templateType as ServiceTemplateType | undefined,
        pledgeType: payload.pledgeType as PledgeType | null | undefined,
      };

      await tx.worshipService.update({
        where: serviceWorkspaceWhere(id, workspaceId),
        data,
      });

      if (payload.bibleVerses) {
        await tx.serviceBibleVerse.deleteMany({ where: { serviceId: id } });
        if (payload.bibleVerses.length > 0) {
          await tx.serviceBibleVerse.createMany({
            data: payload.bibleVerses.map((entry) => ({
              serviceId: id,
              verse: entry.verse,
              order: entry.order,
            })),
          });
        }
      }

      if (payload.servantAssignments) {
        await tx.serviceServantAssignment.deleteMany({ where: { serviceId: id } });
        if (payload.servantAssignments.length > 0) {
          await tx.serviceServantAssignment.createMany({
            data: payload.servantAssignments.map((entry) => ({
              serviceId: id,
              role: entry.role as ServiceServantRole,
              personName: entry.personName,
            })),
          });
        }
      }

      if (payload.hymnals) {
        await tx.serviceHymnal.deleteMany({ where: { serviceId: id } });
        if (payload.hymnals.length > 0) {
          await tx.serviceHymnal.createMany({
            data: payload.hymnals.map((entry) => ({
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
