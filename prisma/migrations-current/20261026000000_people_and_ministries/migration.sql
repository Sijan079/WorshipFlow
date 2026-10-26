-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('VISITOR', 'REGULAR', 'MEMBER', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BaptismStatus" AS ENUM ('BAPTIZED', 'NOT_BAPTIZED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "BlockPerson" ADD COLUMN     "personId" TEXT;

-- AlterTable
ALTER TABLE "ServiceServantAssignment" ADD COLUMN     "personId" TEXT;

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PersonStatus" NOT NULL DEFAULT 'REGULAR',
    "gender" "ServantGender",
    "birthdate" DATE,
    "baptismStatus" "BaptismStatus" NOT NULL DEFAULT 'UNKNOWN',
    "baptismDate" DATE,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "leaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonMinistry" (
    "personId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMinistry_pkey" PRIMARY KEY ("personId","ministryId")
);

-- CreateIndex
CREATE INDEX "Person_workspaceId_status_name_idx" ON "Person"("workspaceId", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ministry_workspaceId_code_key" ON "Ministry"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "PersonMinistry_ministryId_idx" ON "PersonMinistry"("ministryId");

-- AddForeignKey
ALTER TABLE "BlockPerson" ADD CONSTRAINT "BlockPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceServantAssignment" ADD CONSTRAINT "ServiceServantAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMinistry" ADD CONSTRAINT "PersonMinistry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMinistry" ADD CONSTRAINT "PersonMinistry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A baptism date only makes sense for someone known to be baptized.
ALTER TABLE "Person" ADD CONSTRAINT "Person_baptismDate_requires_baptized_check"
  CHECK ("baptismDate" IS NULL OR "baptismStatus" = 'BAPTIZED');

-- Browser clients do not access these Prisma-owned tables through the Supabase Data API.
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ministry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonMinistry" ENABLE ROW LEVEL SECURITY;

-- Seed the default Ministries for every existing workspace.
INSERT INTO "Ministry" ("id", "workspaceId", "code", "label", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, w."id", m.code, m.label, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace" w
CROSS JOIN (VALUES
  ('CHURCH_LEADERS', 'Church Leaders'),
  ('PASTORS', 'Pastors'),
  ('MENS', 'Men''s'),
  ('LADIES', 'Ladies'''),
  ('YOUTH', 'Youth'),
  ('TECH', 'Tech'),
  ('MUSIC', 'Music'),
  ('MIXED', 'Mixed')
) AS m(code, label)
ON CONFLICT ("workspaceId", "code") DO NOTHING;

-- Keep any custom service ministries or servant groups a workspace already created.
-- LEADERS (services) and CHURCH_LEADERS (roster) are the same group.
INSERT INTO "Ministry" ("id", "workspaceId", "code", "label", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."workspaceId", p.code, p.label, p."active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT "workspaceId", CASE WHEN "code" = 'LEADERS' THEN 'CHURCH_LEADERS' ELSE "code" END AS code, "label", "active"
  FROM "MinistryPreset"
  UNION
  SELECT "workspaceId", CASE WHEN "code" = 'LEADERS' THEN 'CHURCH_LEADERS' ELSE "code" END AS code, "label", "active"
  FROM "ServantGroupPreset"
) p
ON CONFLICT ("workspaceId", "code") DO NOTHING;
