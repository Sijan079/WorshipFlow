-- Additive only: one Post table for everything the church writes to be read. Announcements are the first kind;
-- articles arrive with the public site. The older EventAnnouncement table is left untouched.
CREATE TYPE "PostKind" AS ENUM ('ANNOUNCEMENT', 'ARTICLE');

CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "PostKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "startDate" TEXT,
    "endDate" TEXT,
    "eventId" TEXT,
    "facebookText" TEXT,
    "instagramText" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Post_workspaceId_kind_status_idx" ON "Post"("workspaceId", "kind", "status");

CREATE INDEX "Post_eventId_idx" ON "Post"("eventId");

ALTER TABLE "Post" ADD CONSTRAINT "Post_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChurchEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
