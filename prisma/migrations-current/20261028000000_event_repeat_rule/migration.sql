-- Additive only: the repeat rule for events, a public flag, a mark for occurrences edited by hand, and an
-- optional headcount on a worship service. The older recurrence columns stay until a deliberate cleanup.
CREATE TYPE "EventRepeatKind" AS ENUM ('NONE', 'DAILY', 'WEEKLY');

ALTER TABLE "ChurchEvent"
  ADD COLUMN "repeatKind" "EventRepeatKind" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "repeatWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "repeatUntil" TEXT,
  ADD COLUMN "firstLocalDate" TEXT,
  ADD COLUMN "startLocal" TEXT,
  ADD COLUMN "endLocal" TEXT,
  ADD COLUMN "spanDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ChurchEventOccurrence" ADD COLUMN "edited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorshipService" ADD COLUMN "headcount" INTEGER;
