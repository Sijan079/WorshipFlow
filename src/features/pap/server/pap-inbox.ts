import type { Prisma, PrismaClient } from "@prisma/client";
import { deletePrivateOutputFile } from "@/lib/private-output-storage";
import { PAP_INBOX_RETENTION_MS } from "../pap-constants";

type PapInboxClient = Pick<PrismaClient, "papInboxScreenshot"> | Prisma.TransactionClient;

export function sanitizePAPFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "pap-screenshot";
}

export async function cleanupExpiredPAPInboxUploads(client: PapInboxClient, now = new Date()) {
  const expiresBefore = new Date(now.getTime() - PAP_INBOX_RETENTION_MS);
  const expired = await client.papInboxScreenshot.findMany({
    where: {
      createdAt: { lte: expiresBefore },
    },
    select: {
      id: true,
      filePath: true,
    },
  });

  if (expired.length === 0) {
    return 0;
  }

  await client.papInboxScreenshot.deleteMany({
    where: {
      id: { in: expired.map((file) => file.id) },
    },
  });

  await Promise.all(expired.map((file) => deletePrivateOutputFile(file.filePath).catch(() => undefined)));
  return expired.length;
}
