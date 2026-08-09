-- Existing built-in records remain usable as ordinary workspace-owned types.
UPDATE "ProgramBlockType" SET "isSystem" = false WHERE "isSystem" = true;
ALTER TABLE "ProgramBlockType" DROP COLUMN "isSystem";
