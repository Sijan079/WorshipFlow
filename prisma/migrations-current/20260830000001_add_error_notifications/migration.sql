CREATE TABLE "ErrorNotification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorNotification_workspaceId_userId_createdAt_idx"
  ON "ErrorNotification"("workspaceId", "userId", "createdAt");

ALTER TABLE "ErrorNotification" ADD CONSTRAINT "ErrorNotification_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ErrorNotification" ADD CONSTRAINT "ErrorNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
