CREATE TABLE "PAPInboxScreenshot" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "batchIndex" INTEGER NOT NULL,
  "batchTotal" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "note" TEXT,
  "deviceName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PAPInboxScreenshot_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PAPInboxScreenshot" (
  "id",
  "batchId",
  "batchIndex",
  "batchTotal",
  "fileName",
  "filePath",
  "mimeType",
  "size",
  "note",
  "deviceName",
  "createdAt"
)
SELECT
  "id",
  "batchId",
  "batchIndex",
  "batchTotal",
  "fileName",
  "filePath",
  "mimeType",
  "size",
  "note",
  "deviceName",
  "createdAt"
FROM "PAPScreenshot"
WHERE "roomId" = 'global-temporary-inbox';

CREATE INDEX "PAPInboxScreenshot_createdAt_idx" ON "PAPInboxScreenshot"("createdAt");
CREATE INDEX "PAPInboxScreenshot_batchId_createdAt_idx" ON "PAPInboxScreenshot"("batchId", "createdAt");

DROP TABLE IF EXISTS "PAPScreenshot";
DROP TABLE IF EXISTS "PAPTransferRoom";
DROP TABLE IF EXISTS pap_signaling_messages;
