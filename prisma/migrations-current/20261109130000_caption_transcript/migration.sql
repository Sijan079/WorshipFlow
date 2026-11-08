-- A private record of what was heard (source) and what it was translated to (english), one row per
-- finished caption line, kept for checking translation quality. No route or page reads it, and row-level
-- security is on with no policies, so the public key cannot read it either. It is read directly in the
-- database only. sessionId is a plain column (no foreign key) so the record outlives the live session.

-- CreateTable
CREATE TABLE "CaptionTranscriptLine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptionTranscriptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptionTranscriptLine_sessionId_line_key" ON "CaptionTranscriptLine"("sessionId", "line");

-- CreateIndex
CREATE INDEX "CaptionTranscriptLine_workspaceId_createdAt_idx" ON "CaptionTranscriptLine"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "CaptionTranscriptLine" ADD CONSTRAINT "CaptionTranscriptLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaptionTranscriptLine" ENABLE ROW LEVEL SECURITY;
