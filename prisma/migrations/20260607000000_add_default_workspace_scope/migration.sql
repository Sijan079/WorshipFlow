CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

INSERT INTO "Workspace" ("id", "slug", "name", "updatedAt")
VALUES ('default', 'default', 'Default Workspace', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "WorshipService" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Song" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "SongTagPreset" ADD COLUMN "workspaceId" TEXT;

UPDATE "WorshipService" SET "workspaceId" = 'default' WHERE "workspaceId" IS NULL;
UPDATE "Song" SET "workspaceId" = 'default' WHERE "workspaceId" IS NULL;
UPDATE "SongTagPreset" SET "workspaceId" = 'default' WHERE "workspaceId" IS NULL;

ALTER TABLE "WorshipService" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Song" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SongTagPreset" ALTER COLUMN "workspaceId" SET NOT NULL;

DROP INDEX IF EXISTS "SongTagPreset_token_key";

CREATE INDEX "WorshipService_workspaceId_serviceDate_idx" ON "WorshipService"("workspaceId", "serviceDate");
CREATE INDEX "Song_workspaceId_title_idx" ON "Song"("workspaceId", "title");
CREATE UNIQUE INDEX "SongTagPreset_workspaceId_token_key" ON "SongTagPreset"("workspaceId", "token");
CREATE INDEX "SongTagPreset_workspaceId_order_idx" ON "SongTagPreset"("workspaceId", "order");

ALTER TABLE "WorshipService"
ADD CONSTRAINT "WorshipService_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Song"
ADD CONSTRAINT "Song_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongTagPreset"
ADD CONSTRAINT "SongTagPreset_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
