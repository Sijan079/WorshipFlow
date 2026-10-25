CREATE TABLE "CaptionUsageDay" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "meteredCharacters" INTEGER NOT NULL DEFAULT 0,
  "unmeteredRequests" INTEGER NOT NULL DEFAULT 0,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaptionUsageDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaptionUsageDay_workspaceId_day_key" ON "CaptionUsageDay"("workspaceId", "day");

ALTER TABLE "CaptionUsageDay" ADD CONSTRAINT "CaptionUsageDay_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaptionUsageDay" ENABLE ROW LEVEL SECURITY;
