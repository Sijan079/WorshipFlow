-- Person: one name becomes a required first name and last name.
-- The table was empty when this ran, so no data moves; the default only keeps the
-- statement valid on a database that already holds rows.
ALTER TABLE "Person" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
UPDATE "Person" SET "firstName" = "name";
ALTER TABLE "Person" ALTER COLUMN "firstName" DROP DEFAULT,
ALTER COLUMN "lastName" DROP DEFAULT;
ALTER TABLE "Person" DROP COLUMN "name";

-- Dropping the column already drops its index; this keeps the statement safe either way.
DROP INDEX IF EXISTS "Person_workspaceId_status_name_idx";
CREATE INDEX "Person_workspaceId_status_lastName_firstName_idx" ON "Person"("workspaceId", "status", "lastName", "firstName");

-- Services point at a Ministry. The old enum and code columns stay until the final cleanup.
ALTER TABLE "WorshipService" ADD COLUMN "ministryId" TEXT;
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing services keep their ministry. LEADERS (services) and CHURCH_LEADERS (roster) are one group.
UPDATE "WorshipService" s
SET "ministryId" = m."id"
FROM "Ministry" m
WHERE m."workspaceId" = s."workspaceId"
  AND m."code" = CASE
    WHEN COALESCE(s."ministryPresetCode", s."assignedMinistry"::text) = 'LEADERS' THEN 'CHURCH_LEADERS'
    ELSE COALESCE(s."ministryPresetCode", s."assignedMinistry"::text)
  END;
