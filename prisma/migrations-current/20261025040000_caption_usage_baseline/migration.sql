CREATE TABLE "CaptionUsageBaseline" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "month" DATE NOT NULL,
  "characters" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaptionUsageBaseline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaptionUsageBaseline_workspaceId_month_key" ON "CaptionUsageBaseline"("workspaceId", "month");

ALTER TABLE "CaptionUsageBaseline" ADD CONSTRAINT "CaptionUsageBaseline_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaptionUsageBaseline" ENABLE ROW LEVEL SECURITY;
