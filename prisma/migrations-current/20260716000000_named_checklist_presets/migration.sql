-- Create the named checklist parent before moving existing items.
CREATE TABLE "ChecklistPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistPreset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Workspace" ADD COLUMN "activeChecklistId" TEXT;
ALTER TABLE "ChecklistItemPreset" ADD COLUMN "checklistId" TEXT;

-- One protected, editable set per existing workspace. Deterministic text IDs
-- make this migration safe without requiring a database UUID extension.
INSERT INTO "ChecklistPreset" ("id", "workspaceId", "name", "isDefault", "createdAt", "updatedAt")
SELECT "id" || ':default-checklist', "id", 'Before every worship service', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace";

UPDATE "ChecklistItemPreset" AS item
SET "checklistId" = item."workspaceId" || ':default-checklist';

UPDATE "Workspace"
SET "activeChecklistId" = "id" || ':default-checklist';

ALTER TABLE "ChecklistItemPreset" ALTER COLUMN "checklistId" SET NOT NULL;

DROP INDEX "ChecklistItemPreset_workspaceId_order_idx";
ALTER TABLE "ChecklistItemPreset" DROP CONSTRAINT "ChecklistItemPreset_workspaceId_fkey";
ALTER TABLE "ChecklistItemPreset" DROP COLUMN "workspaceId";
ALTER TABLE "ChecklistItemPreset" DROP COLUMN "isDefault";

CREATE INDEX "ChecklistPreset_workspaceId_name_idx" ON "ChecklistPreset"("workspaceId", "name");
CREATE INDEX "ChecklistItemPreset_checklistId_order_idx" ON "ChecklistItemPreset"("checklistId", "order");

ALTER TABLE "ChecklistPreset" ADD CONSTRAINT "ChecklistPreset_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemPreset" ADD CONSTRAINT "ChecklistItemPreset_checklistId_fkey"
  FOREIGN KEY ("checklistId") REFERENCES "ChecklistPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_activeChecklistId_fkey"
  FOREIGN KEY ("activeChecklistId") REFERENCES "ChecklistPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistPreset" ENABLE ROW LEVEL SECURITY;
