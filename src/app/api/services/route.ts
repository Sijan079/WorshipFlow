import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { WorshipServiceSchema } from "@/lib/validation";
import { getServiceBlockOrder, serviceDetailInclude } from "@/lib/service-data";
import { BLOCK_LABELS } from "@/lib/service-display";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { validateTemplateBlocks } from "@/lib/settings-presets";
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
    });

    const serviceIds = services.map((service) => service.id);

    if (serviceIds.length === 0) {
      return NextResponse.json([]);
    }

    const [bibleVerses, servantAssignments, hymnals] = await Promise.all([
      prisma.serviceBibleVerse.findMany({
        where: { serviceId: { in: serviceIds } },
        orderBy: [{ serviceId: "asc" }, { order: "asc" }],
      }),
      prisma.serviceServantAssignment.findMany({
        where: { serviceId: { in: serviceIds } },
        orderBy: [{ serviceId: "asc" }, { role: "asc" }],
      }),
      prisma.serviceHymnal.findMany({
        where: { serviceId: { in: serviceIds } },
        orderBy: [{ serviceId: "asc" }, { role: "asc" }],
      }),
    ]);

    const bibleVersesByService = Object.groupBy(bibleVerses, (entry) => entry.serviceId);
    const servantAssignmentsByService = Object.groupBy(servantAssignments, (entry) => entry.serviceId);
    const hymnalsByService = Object.groupBy(hymnals, (entry) => entry.serviceId);

    return NextResponse.json(
      services.map((service) => ({
        ...service,
        bibleVerses: bibleVersesByService[service.id] ?? [],
        servantAssignments: servantAssignmentsByService[service.id] ?? [],
        hymnals: hymnalsByService[service.id] ?? [],
      }))
    );
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
      ministryPresetCode,
      pledgeType,
      sermonVerse,
      servantAssignments,
      serviceDate,
      status,
      templatePresetCode,
      templateType,
    } = result.data;
    const [ministryPreset, templatePreset] = await Promise.all([
      ministryPresetCode
        ? prisma.ministryPreset.findFirst({ where: { workspaceId, code: ministryPresetCode } })
        : Promise.resolve(null),
      templatePresetCode
        ? prisma.serviceTemplatePreset.findFirst({ where: { workspaceId, code: templatePresetCode } })
        : Promise.resolve(null),
    ]);
    const resolvedTemplateType = (templatePreset?.templateType ?? templateType) as ServiceTemplateType;
    const ministryName = ministryPreset?.label ?? mapAssignedMinistryToLegacyMinistryName(assignedMinistry as AssignedMinistry);
    const serviceVariant = mapTemplateTypeToServiceVariant(resolvedTemplateType);

    const newService = await prisma.$transaction(async (tx) => {
      const service = await tx.worshipService.create({
        data: {
          workspaceId,
          serviceDate,
          assignedMinistry: assignedMinistry as AssignedMinistry,
          ministryPresetCode: ministryPreset?.code ?? ministryPresetCode ?? null,
          sermonVerse,
          ministryName,
          status,
          serviceVariant,
          templateType: resolvedTemplateType,
          templatePresetCode: templatePreset?.code ?? templatePresetCode ?? null,
          pledgeType: pledgeType as PledgeType | null | undefined,
        },
      });

      const templateBlocks = templatePreset?.blocks && Array.isArray(templatePreset.blocks) && templatePreset.blocks.length > 0
        ? validateTemplateBlocks(templatePreset.blocks as Array<{ label: string; code?: string; blockType?: string; order?: number }>)
        : getServiceBlockOrder(serviceVariant).map((blockType, order) => ({
            label: BLOCK_LABELS[blockType],
            code: blockType,
            blockType,
            order,
          }));
      await Promise.all(
        templateBlocks.map((block, index) =>
          tx.worshipServiceBlock.create({
            data: {
              serviceId: service.id,
              blockType: block.blockType,
              label: block.label,
              code: block.code,
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
