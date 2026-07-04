ALTER TABLE "WorshipService" ADD COLUMN "ministryPresetCode" TEXT;
ALTER TABLE "WorshipService" ADD COLUMN "templatePresetCode" TEXT;
ALTER TABLE "Servant" ADD COLUMN "groupCode" TEXT;

CREATE TABLE "MinistryPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantGroupPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantGroupPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChecklistItemPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItemPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceTemplatePreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "templateType" "ServiceTemplateType" NOT NULL,
    "optionalBlocks" "BlockType"[] NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTemplatePreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MinistryPreset_workspaceId_code_key" ON "MinistryPreset"("workspaceId", "code");
CREATE INDEX "MinistryPreset_workspaceId_order_idx" ON "MinistryPreset"("workspaceId", "order");

CREATE UNIQUE INDEX "ServantGroupPreset_workspaceId_code_key" ON "ServantGroupPreset"("workspaceId", "code");
CREATE INDEX "ServantGroupPreset_workspaceId_order_idx" ON "ServantGroupPreset"("workspaceId", "order");

CREATE INDEX "ChecklistItemPreset_workspaceId_order_idx" ON "ChecklistItemPreset"("workspaceId", "order");

CREATE UNIQUE INDEX "ServiceTemplatePreset_workspaceId_code_key" ON "ServiceTemplatePreset"("workspaceId", "code");
CREATE INDEX "ServiceTemplatePreset_workspaceId_order_idx" ON "ServiceTemplatePreset"("workspaceId", "order");

ALTER TABLE "MinistryPreset" ADD CONSTRAINT "MinistryPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantGroupPreset" ADD CONSTRAINT "ServantGroupPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemPreset" ADD CONSTRAINT "ChecklistItemPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTemplatePreset" ADD CONSTRAINT "ServiceTemplatePreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
