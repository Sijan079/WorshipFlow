-- Mixed is how a service is run (a mixed team on a 5th Sunday), not a group people belong to.
-- Service-only ministries are hidden from People and Ministries and offered only on services.
ALTER TABLE "Ministry" ADD COLUMN "serviceOnly" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Ministry" SET "serviceOnly" = true WHERE "code" = 'MIXED';
