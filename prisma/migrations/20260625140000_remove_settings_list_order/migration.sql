DROP INDEX IF EXISTS "SongTagPreset_order_idx";
DROP INDEX IF EXISTS "SongTagPreset_workspaceId_order_idx";
DROP INDEX IF EXISTS "MinistryPreset_workspaceId_order_idx";
DROP INDEX IF EXISTS "ServantGroupPreset_workspaceId_order_idx";
DROP INDEX IF EXISTS "ServiceTemplatePreset_workspaceId_order_idx";

ALTER TABLE "SongTagPreset" DROP COLUMN IF EXISTS "order";
ALTER TABLE "MinistryPreset" DROP COLUMN IF EXISTS "order";
ALTER TABLE "ServantGroupPreset" DROP COLUMN IF EXISTS "order";
ALTER TABLE "ServiceTemplatePreset" DROP COLUMN IF EXISTS "order";
