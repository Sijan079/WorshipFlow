import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { WorshipServiceSchema } from "@/lib/validation";
import { serviceDetailInclude } from "@/lib/service-data";
import { getEmptyBlockValues, validateTemplateBlockValues } from "@/lib/template-block-kinds";
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
      include: {
        blocks: {
          orderBy: {
            order: "asc",
          },
          include: {
            people: {
              orderBy: {
                order: "asc",
              },
            },
            songs: {
              orderBy: {
                order: "asc",
              },
              include: {
                song: true,
              },
            },
            details: {
              orderBy: {
                key: "asc",
              },
            },
          },
        },
      },
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
      ministryPresetCode,
      pledgeType,
      sermonVerse,
      servantAssignments,
      serviceDate,
      status,
      templateBlockValues,
      templatePresetCode,
      templateType,
    } = result.data;
    const [ministryPreset, templatePreset] = await Promise.all([
      ministryPresetCode
        ? prisma.ministryPreset.findFirst({ where: { workspaceId, code: ministryPresetCode } })
        : Promise.resolve(null),
      templatePresetCode
        ? prisma.serviceTemplatePreset.findFirst({
            where: { workspaceId, code: templatePresetCode },
            include: {
              templateBlocks: {
                where: { active: true },
                orderBy: { order: "asc" },
                include: {},
              },
            },
          })
        : Promise.resolve(null),
    ]);
    if (!templatePresetCode || !templatePreset) {
      return NextResponse.json({ error: "Select a valid saved service template." }, { status: 400 });
    }
    const resolvedTemplateType = (templatePreset?.templateType ?? templateType) as ServiceTemplateType;
    const ministryName = ministryPreset?.label ?? mapAssignedMinistryToLegacyMinistryName(assignedMinistry as AssignedMinistry);
    const serviceVariant = mapTemplateTypeToServiceVariant(resolvedTemplateType);
    const persistedTemplateBlocks = templatePreset.templateBlocks;
    if (persistedTemplateBlocks.length === 0) {
      return NextResponse.json({ error: "The selected service template has no active ordered blocks." }, { status: 400 });
    }
    const valuesByTemplateBlock = new Map(templateBlockValues.map((entry) => [entry.templateBlockId, entry.values]));
    if (valuesByTemplateBlock.size !== templateBlockValues.length) {
      return NextResponse.json({ error: "Each template block can only be submitted once." }, { status: 400 });
    }
    const templateBlockIds = new Set(persistedTemplateBlocks.map((block) => block.id));
    if ([...valuesByTemplateBlock.keys()].some((id) => !templateBlockIds.has(id))) {
      return NextResponse.json({ error: "Submitted values do not belong to the selected template." }, { status: 400 });
    }
    const resolvedTemplateBlocks = persistedTemplateBlocks.map((block) => {
      const values = validateTemplateBlockValues(block.kind, valuesByTemplateBlock.get(block.id) ?? getEmptyBlockValues(block.kind));
      if (!values.valid) throw new Error(`Invalid values for ${block.label ?? "program block"}`);
      return { block, values: values.values };
    });
    const selectedPersonIds = resolvedTemplateBlocks.flatMap(({ block, values }) => block.kind === "PERSON" ? (values as { personIds: string[] }).personIds : []);
    if (selectedPersonIds.length > 0) {
      const count = await prisma.servant.count({ where: { workspaceId, id: { in: selectedPersonIds } } });
      if (count !== new Set(selectedPersonIds).size) return NextResponse.json({ error: "A selected person is unavailable in this workspace" }, { status: 400 });
    }

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

      await Promise.all(
        resolvedTemplateBlocks.map(({ block, values }) =>
          tx.worshipServiceBlock.create({
            data: {
              serviceId: service.id,
              blockType: "CUSTOM",
              kind: block.kind,
              label: block.label,
              code: block.code,
              order: block.order,
              fieldDefinition: { fields: [] } as Prisma.InputJsonValue,
              fieldValues: values as Prisma.InputJsonValue,
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
