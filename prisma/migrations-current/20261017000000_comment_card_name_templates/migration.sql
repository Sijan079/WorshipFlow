CREATE TABLE "CommentCardNameTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(72) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommentCardNameTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Workspace" ADD COLUMN "activeCommentCardNameTemplateId" TEXT;

CREATE INDEX "CommentCardNameTemplate_workspaceId_createdAt_idx" ON "CommentCardNameTemplate"("workspaceId", "createdAt");

ALTER TABLE "CommentCardNameTemplate" ADD CONSTRAINT "CommentCardNameTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_activeCommentCardNameTemplateId_fkey" FOREIGN KEY ("activeCommentCardNameTemplateId") REFERENCES "CommentCardNameTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommentCardNameTemplate" ENABLE ROW LEVEL SECURITY;
