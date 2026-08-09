CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authProviderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_authProviderId_key" ON "User"("authProviderId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE INDEX "WorkspaceMembership_userId_status_idx" ON "WorkspaceMembership"("userId", "status");

CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "invitedByUserId" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceInvitation_workspaceId_email_status_idx" ON "WorkspaceInvitation"("workspaceId", "email", "status");
CREATE INDEX "WorkspaceInvitation_email_status_idx" ON "WorkspaceInvitation"("email", "status");
CREATE UNIQUE INDEX "WorkspaceInvitation_pending_workspace_email_key"
  ON "WorkspaceInvitation"("workspaceId", "email") WHERE "status" = 'PENDING';

ALTER TABLE "PAPInboxScreenshot" ADD COLUMN "workspaceId" TEXT;
INSERT INTO "Workspace" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('default-workspace', 'Default Workspace', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
UPDATE "PAPInboxScreenshot" SET "workspaceId" = (SELECT "id" FROM "Workspace" WHERE "slug" = 'default' LIMIT 1);
ALTER TABLE "PAPInboxScreenshot" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "PAPInboxScreenshot_workspaceId_createdAt_idx" ON "PAPInboxScreenshot"("workspaceId", "createdAt");

ALTER TABLE "AutomationJob" ADD COLUMN "requestedByUserId" TEXT;

ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PAPInboxScreenshot" ADD CONSTRAINT "PAPInboxScreenshot_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
