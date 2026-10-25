ALTER TABLE "WorkspaceActionGrant" ADD COLUMN "allowed" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "WorkspaceRoleActionDefault" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "module" "WorkspaceModule" NOT NULL,
    "action" "WorkspaceAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceRoleActionDefault_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceRoleActionDefault_member_only" CHECK ("role" = 'MEMBER')
);

CREATE UNIQUE INDEX "WorkspaceRoleActionDefault_workspaceId_role_module_action_key" ON "WorkspaceRoleActionDefault"("workspaceId","role","module","action");
CREATE INDEX "WorkspaceRoleActionDefault_workspaceId_role_idx" ON "WorkspaceRoleActionDefault"("workspaceId","role");
ALTER TABLE "WorkspaceRoleActionDefault" ADD CONSTRAINT "WorkspaceRoleActionDefault_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRoleActionDefault" ENABLE ROW LEVEL SECURITY;
