CREATE TYPE "CaptionSessionStatus" AS ENUM ('LIVE', 'ENDED');

CREATE TABLE "CaptionSession" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "operatorUserId" TEXT NOT NULL,
  "operatorTokenHash" TEXT NOT NULL,
  "status" "CaptionSessionStatus" NOT NULL DEFAULT 'LIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "CaptionSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaptionLine" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "line" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "english" TEXT NOT NULL,
  "final" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaptionLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaptionSession_workspaceId_status_expiresAt_idx" ON "CaptionSession"("workspaceId", "status", "expiresAt");
CREATE UNIQUE INDEX "CaptionSession_one_live_per_workspace" ON "CaptionSession"("workspaceId") WHERE "status" = 'LIVE';
CREATE UNIQUE INDEX "CaptionLine_sessionId_line_key" ON "CaptionLine"("sessionId", "line");
CREATE INDEX "CaptionLine_sessionId_line_idx" ON "CaptionLine"("sessionId", "line");

ALTER TABLE "CaptionSession" ADD CONSTRAINT "CaptionSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptionSession" ADD CONSTRAINT "CaptionSession_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptionLine" ADD CONSTRAINT "CaptionLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CaptionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaptionSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaptionLine" ENABLE ROW LEVEL SECURITY;
