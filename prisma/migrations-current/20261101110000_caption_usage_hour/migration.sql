-- CreateTable
CREATE TABLE "CaptionUsageHour" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "meteredCharacters" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CaptionUsageHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptionUsageHour_workspaceId_hour_key" ON "CaptionUsageHour"("workspaceId", "hour");

-- AddForeignKey
ALTER TABLE "CaptionUsageHour" ADD CONSTRAINT "CaptionUsageHour_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
