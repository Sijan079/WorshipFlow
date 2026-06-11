CREATE TABLE "PAPTransferRoom" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "PAPTransferRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PAPScreenshot" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
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

  CONSTRAINT "PAPScreenshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PAPTransferRoom_tokenHash_key" ON "PAPTransferRoom"("tokenHash");
CREATE INDEX "PAPTransferRoom_expiresAt_idx" ON "PAPTransferRoom"("expiresAt");
CREATE INDEX "PAPScreenshot_roomId_createdAt_idx" ON "PAPScreenshot"("roomId", "createdAt");
CREATE INDEX "PAPScreenshot_roomId_batchId_idx" ON "PAPScreenshot"("roomId", "batchId");

ALTER TABLE "PAPScreenshot"
ADD CONSTRAINT "PAPScreenshot_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "PAPTransferRoom"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
