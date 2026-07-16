ALTER TABLE "Workspace"
ADD COLUMN "serviceTemplatesInitialized" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Workspace" AS workspace
SET "serviceTemplatesInitialized" = true
WHERE EXISTS (
  SELECT 1
  FROM "ServiceTemplatePreset" AS template
  WHERE template."workspaceId" = workspace.id
);

UPDATE "ServiceTemplatePreset"
SET "active" = true,
    "isDefault" = false;
