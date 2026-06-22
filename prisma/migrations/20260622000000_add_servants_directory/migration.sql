-- CreateEnum
CREATE TYPE "ServantGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ServantGroup" AS ENUM ('PASTORS', 'CHURCH_LEADERS', 'MENS', 'LADIES', 'YOUTH', 'TECH', 'MUSIC');

-- CreateTable
CREATE TABLE "Servant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "ServantGender" NOT NULL,
    "group" "ServantGroup" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Servant_workspaceId_name_idx" ON "Servant"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Servant_workspaceId_group_name_idx" ON "Servant"("workspaceId", "group", "name");

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
