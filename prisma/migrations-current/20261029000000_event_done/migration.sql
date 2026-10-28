-- Additive only: when a one-time event was marked done. Empty until someone marks it.
ALTER TABLE "ChurchEventOccurrence" ADD COLUMN "doneAt" TIMESTAMP(3);
