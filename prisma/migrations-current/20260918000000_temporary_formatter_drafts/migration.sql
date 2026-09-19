CREATE TABLE "FormatterConversion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "songTitle" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "parser" TEXT NOT NULL,
  "jobId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Draft' CHECK ("status" IN ('Draft', 'Done', 'Failed')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);
CREATE INDEX "FormatterConversion_workspaceId_userId_createdAt_idx" ON "FormatterConversion"("workspaceId", "userId", "createdAt");
CREATE TABLE "FormatterDraft" (
  "conversionId" TEXT NOT NULL PRIMARY KEY REFERENCES "FormatterConversion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "sessionId" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "FormatterDraft_workspaceId_userId_key" ON "FormatterDraft"("workspaceId", "userId");
CREATE INDEX "FormatterDraft_expiresAt_idx" ON "FormatterDraft"("expiresAt");
CREATE INDEX "FormatterDraft_lastSeenAt_idx" ON "FormatterDraft"("lastSeenAt");
