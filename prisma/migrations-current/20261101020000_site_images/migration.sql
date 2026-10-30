-- Additive only: the record of each picture uploaded for the website. The file itself is in private storage.
CREATE TABLE "SiteImage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteImage_workspaceId_idx" ON "SiteImage"("workspaceId");

ALTER TABLE "SiteImage" ADD CONSTRAINT "SiteImage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
