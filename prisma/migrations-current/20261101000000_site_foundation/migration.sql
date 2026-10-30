-- Additive only: the public site's own tables and its permission module. Nothing here touches People data.
ALTER TYPE "WorkspaceModule" ADD VALUE IF NOT EXISTS 'SITE';

CREATE TYPE "SiteBlockType" AS ENUM ('HEADING', 'RICH_TEXT', 'ANNOUNCEMENTS_LIST', 'EVENTS_LIST', 'SERVICE_TIMES', 'CONTACT');

CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SitePageBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" "SiteBlockType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePageBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteSettings_workspaceId_key" ON "SiteSettings"("workspaceId");

CREATE UNIQUE INDEX "SitePage_workspaceId_slug_key" ON "SitePage"("workspaceId", "slug");

CREATE INDEX "SitePage_workspaceId_status_idx" ON "SitePage"("workspaceId", "status");

CREATE INDEX "SitePageBlock_pageId_sortOrder_idx" ON "SitePageBlock"("pageId", "sortOrder");

ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SitePageBlock" ADD CONSTRAINT "SitePageBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
