ALTER TABLE "AutomationJob" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "GeneratedOutput" ADD COLUMN "workspaceId" TEXT;

UPDATE "AutomationJob" AS job
SET "workspaceId" = service."workspaceId"
FROM "WorshipService" AS service
WHERE job."serviceId" = service."id";

UPDATE "GeneratedOutput" AS output
SET "workspaceId" = service."workspaceId"
FROM "WorshipService" AS service
WHERE output."serviceId" = service."id";

UPDATE "AutomationJob"
SET "workspaceId" = 'default'
WHERE "workspaceId" IS NULL;

UPDATE "GeneratedOutput"
SET "workspaceId" = 'default'
WHERE "workspaceId" IS NULL;

ALTER TABLE "AutomationJob" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "GeneratedOutput" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "AutomationJob" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "GeneratedOutput" ALTER COLUMN "serviceId" DROP NOT NULL;

ALTER TABLE "AutomationJob"
ADD CONSTRAINT "AutomationJob_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedOutput"
ADD CONSTRAINT "GeneratedOutput_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AutomationJob_workspaceId_createdAt_idx" ON "AutomationJob"("workspaceId", "createdAt");
CREATE INDEX "GeneratedOutput_workspaceId_createdAt_idx" ON "GeneratedOutput"("workspaceId", "createdAt");
