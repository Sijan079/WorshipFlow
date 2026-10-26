-- The "Share captions link" permission (an additive action value).
ALTER TYPE "WorkspaceAction" ADD VALUE IF NOT EXISTS 'SHARE';

-- One stable listener link per church. The token is in the public URL and is shown again as a QR
-- code, so it is stored as plain text; it only grants read-only caption text.
CREATE TABLE "CaptionSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "viewerToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "CaptionSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaptionSettings_workspaceId_key" ON "CaptionSettings"("workspaceId");
CREATE UNIQUE INDEX "CaptionSettings_viewerToken_key" ON "CaptionSettings"("viewerToken");

ALTER TABLE "CaptionSettings" ADD CONSTRAINT "CaptionSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Browser clients do not access this Prisma-owned table through the Supabase Data API.
ALTER TABLE "CaptionSettings" ENABLE ROW LEVEL SECURITY;
