-- QUEUED, NOT APPLIED. Move this folder into prisma/migrations-current only when the
-- new code (People, Ministries) is merged and deployed. The live app still on the old
-- code reads these tables, and it shares the hosted database with local development.
-- This permanently deletes the old Teams roster, which the owner chose not to migrate.
DROP TABLE "Servant";
DROP TABLE "ServantGroupPreset";
DROP TYPE "ServantGroup";
