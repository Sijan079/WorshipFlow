-- Additive only: who is editing a page right now, so a second person gets a view-only page instead of overwriting.
ALTER TABLE "SitePage" ADD COLUMN "lockedById" TEXT;
ALTER TABLE "SitePage" ADD COLUMN "lockedAt" TIMESTAMP(3);
