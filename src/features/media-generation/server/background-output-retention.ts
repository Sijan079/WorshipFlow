import { OutputType } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { deletePrivateOutputFile } from "../../../lib/private-output-storage.ts";

export const BACKGROUND_OUTPUT_TTL_MS = 24 * 60 * 60 * 1000;

type BackgroundOutputRetentionClient = Pick<PrismaClient, "generatedOutput">;

export function getExpiredBackgroundOutputCutoff(now = new Date()) {
  return new Date(now.getTime() - BACKGROUND_OUTPUT_TTL_MS);
}

export async function deleteExpiredBackgroundOutputs(
  prisma: BackgroundOutputRetentionClient,
  workspaceId: string,
  now = new Date()
) {
  const cutoff = getExpiredBackgroundOutputCutoff(now);
  const expiredOutputs = await prisma.generatedOutput.findMany({
    where: {
      workspaceId,
      type: { in: [OutputType.BACKGROUND_IMAGE, OutputType.BACKGROUND_VIDEO] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      filePath: true,
    },
  });

  if (expiredOutputs.length === 0) {
    return 0;
  }

  await prisma.generatedOutput.deleteMany({
    where: {
      id: { in: expiredOutputs.map((output) => output.id) },
    },
  });

  await Promise.all(expiredOutputs.map((output) => deletePrivateOutputFile(output.filePath).catch(() => undefined)));
  return expiredOutputs.length;
}
