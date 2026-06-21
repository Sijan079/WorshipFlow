import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { WorshipServiceSchema } from "@/lib/validation";
import { getServiceBlockOrder, serviceDetailInclude, serviceListInclude } from "@/lib/service-data";
import { getActiveWorkspaceId } from "@/lib/security-context";
import {
  type AssignedMinistry,
  mapAssignedMinistryToLegacyMinistryName,
  mapTemplateTypeToServiceVariant,
  type PledgeType,
  type ServiceHymnalRole,
  type ServiceServantRole,
  type ServiceTemplateType,
} from "@/lib/service-records";

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const services = await prisma.worshipService.findMany({
      where: { workspaceId },
      orderBy: {
        serviceDate: "asc",
      },
      include: serviceListInclude,
    });
    return NextResponse.json(services);
  } catch (error: unknown) {
    console.error("GET /api/services error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch services") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const body = await request.json();
    const result = WorshipServiceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const {
      assignedMinistry,
      bibleVerses,
      hymnals,
      pledgeType,
      sermonVerse,
      servantAssignments,
      serviceDate,
      status,
      templateType,
    } = result.data;
    const ministryName = mapAssignedMinistryToLegacyMinistryName(assignedMinistry as AssignedMinistry);
    const serviceVariant = mapTemplateTypeToServiceVariant(templateType as ServiceTemplateType);

    const newService = await prisma.$transaction(async (tx) => {
      const service = await tx.worshipService.create({
        data: {
          workspaceId,
          serviceDate,
          assignedMinistry: assignedMinistry as AssignedMinistry,
          sermonVerse,
          ministryName,
          status,
          serviceVariant,
          templateType: templateType as ServiceTemplateType,
          pledgeType: pledgeType as PledgeType | null | undefined,
        },
      });

      // Create service blocks in strict order.
      const blockOrder = getServiceBlockOrder(serviceVariant);
      await Promise.all(
        blockOrder.map((blockType, index) =>
          tx.worshipServiceBlock.create({
            data: {
              serviceId: service.id,
              blockType,
              order: index,
            },
          })
        )
      );

      if (bibleVerses.length > 0) {
        await tx.serviceBibleVerse.createMany({
          data: bibleVerses.map((entry) => ({
            serviceId: service.id,
            verse: entry.verse,
            order: entry.order,
          })),
        });
      }

      if (servantAssignments.length > 0) {
        await tx.serviceServantAssignment.createMany({
          data: servantAssignments.map((entry) => ({
            serviceId: service.id,
            role: entry.role as ServiceServantRole,
            personName: entry.personName,
          })),
        });
      }

      if (hymnals.length > 0) {
        await tx.serviceHymnal.createMany({
          data: hymnals.map((entry) => ({
            serviceId: service.id,
            role: entry.role as ServiceHymnalRole,
            title: entry.title,
          })),
        });
      }

      return service;
    });

    const completeService = await prisma.worshipService.findUnique({
      where: { id: newService.id, workspaceId },
      include: serviceDetailInclude,
    });

    return NextResponse.json(completeService, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create service") }, { status: 500 });
  }
}
