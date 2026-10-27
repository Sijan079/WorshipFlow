-- Applied on the owner's explicit instruction on 2026-10-27, after the People and Ministries
-- code was deployed (the code on main no longer reads these tables).
-- This permanently deletes the old Teams roster, which the owner chose not to migrate.
DROP TABLE "Servant";
DROP TABLE "ServantGroupPreset";
DROP TYPE "ServantGroup";
