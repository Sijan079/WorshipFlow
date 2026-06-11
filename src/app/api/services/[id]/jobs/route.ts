import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import { savePrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";
import { AutomationJobSchema, TransposeAutomationJobSchema } from "@/lib/validation";
import { JobStatus, OutputType } from "@prisma/client";
import { createExtractorJob, processExtractorJob } from "@/lib/extractor-workflow";
import { getActiveWorkspaceId, serviceWorkspaceWhere } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type JobOutputPayload = Prisma.InputJsonObject;
type JobInputPayload = Prisma.InputJsonObject;

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const jobs = await prisma.automationJob.findMany({
      where: { serviceId, service: { workspaceId } },
      include: {
        outputs: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(jobs);
  } catch (error: unknown) {
    console.error("GET /api/services/[id]/jobs error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch jobs") }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const body = await request.json();
    const result = AutomationJobSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const { jobType, inputJson } = result.data;
    const normalizedInput =
      inputJson && typeof inputJson === "object" && !Array.isArray(inputJson)
        ? (inputJson as JobInputPayload)
        : {};

    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(serviceId, workspaceId),
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    if (jobType === "TRANSPOSE") {
      const extractorPayload = TransposeAutomationJobSchema.safeParse({
        jobType,
        inputJson,
      });

      if (!extractorPayload.success) {
        return NextResponse.json({ error: extractorPayload.error.format() }, { status: 400 });
      }

      const job = await createExtractorJob(serviceId, extractorPayload.data.inputJson);

      try {
        await processExtractorJob(serviceId, job.id, extractorPayload.data.inputJson);
        const completedJob = await prisma.automationJob.findUnique({
          where: { id: job.id },
          include: { outputs: true },
        });

        return NextResponse.json({ job: completedJob }, { status: 201 });
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err, "Lyrics extraction failed");
        const status =
          errorMessage === "Temporary automation upload is unavailable or expired." ? 410 : 500;

        await prisma.automationJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            outputJson: { error: errorMessage },
          },
        });

        return NextResponse.json({ error: errorMessage }, { status });
      }
    }

    const job = await prisma.automationJob.create({
      data: {
        serviceId,
        jobType,
        status: JobStatus.QUEUED,
        inputJson: normalizedInput,
      },
    });

    (async () => {
      try {
        await prisma.automationJob.update({
          where: { id: job.id },
          data: { status: JobStatus.PROCESSING },
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        let outputJson: JobOutputPayload = {};
        let outputType: OutputType = OutputType.ZIP;
        let mockFileName = `job-${job.id}.zip`;

        if (jobType === "FREESHOW_GENERATE") {
          outputType = OutputType.FREESHOW;
          mockFileName = `worship-flow-${service.ministryName.toLowerCase().replace(/\s+/g, "-")}.freeshow`;
          outputJson = {
            format: "FreeShow Export",
            version: "1.0",
            serviceDate: service.serviceDate,
            ministry: service.ministryName,
            exportedAt: new Date().toISOString(),
          };
        } else if (jobType === "CAPTION_GENERATE") {
          outputType = OutputType.CAPTION_PACK;
          mockFileName = `caption-pack-${serviceId}.zip`;
          outputJson = {
            captionsCount: 12,
            resolutions: ["1920x1080"],
          };
        } else if (jobType === "BACKGROUND_IMAGE_GENERATE" || jobType === "BACKGROUND_VIDEO_GENERATE") {
          outputType = jobType === "BACKGROUND_VIDEO_GENERATE" ? OutputType.BACKGROUND_VIDEO : OutputType.BACKGROUND_IMAGE;
          mockFileName = `background-generation-disabled-${job.id}.txt`;
          outputJson = {
            note: "Use the dedicated Media Tools background generator workflow.",
          };
        }

        const savedFile = await savePrivateOutputFile(
          "outputs",
          mockFileName,
          new TextEncoder().encode(JSON.stringify(outputJson, null, 2)),
          {
            contentType: "application/json; charset=utf-8",
          }
        );

        await prisma.$transaction(async (tx) => {
          await tx.automationJob.update({
            where: { id: job.id },
            data: {
              status: JobStatus.DONE,
              completedAt: new Date(),
              outputJson,
            },
          });

          await tx.generatedOutput.create({
            data: {
              serviceId,
              jobId: job.id,
              type: outputType,
              filePath: savedFile.relativePath,
            },
          });
        });
      } catch (err: unknown) {
        console.error(`Error in automation job ${job.id}:`, err);
        await prisma.automationJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            outputJson: { error: getErrorMessage(err, "Unknown error occurred") },
          },
        });
      }
    })();

    return NextResponse.json(job, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/jobs error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to trigger automation job") }, { status: 500 });
  }
}
