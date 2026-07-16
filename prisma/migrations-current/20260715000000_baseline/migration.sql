-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceVariant" AS ENUM ('STANDARD', 'EXTENDED');

-- CreateEnum
CREATE TYPE "AssignedMinistry" AS ENUM ('LEADERS', 'YOUTH', 'MENS', 'LADIES', 'MIXED');

-- CreateEnum
CREATE TYPE "ServiceTemplateType" AS ENUM ('REGULAR', 'FIRST_SUNDAY');

-- CreateEnum
CREATE TYPE "PledgeType" AS ENUM ('PLEDGE_OF_FAITH', 'COVENANT');

-- CreateEnum
CREATE TYPE "ServiceServantRole" AS ENUM ('CALL_TO_WORSHIP', 'EMCEE', 'SCRIPTURE_READER', 'SERMON_SPEAKER', 'OFFERING', 'PLEDGE_READER');

-- CreateEnum
CREATE TYPE "ServiceHymnalRole" AS ENUM ('HYMN_OF_PREPARATION', 'HYMN_OF_RESPONSE', 'SONG_OF_HYMNS');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('CALL_TO_WORSHIP', 'PRAISE_AND_WORSHIP', 'MC', 'AWIT_NG_HIMNO', 'TIPAN_PAHAYAG', 'AWIT_NG_PAKIKINIG', 'SCRIPTURE_READING', 'SERMON', 'AWIT_NG_PAGTUGON', 'OFFERING', 'FLOWERS_FOR_THE_LORD', 'DETAILS');

-- CreateEnum
CREATE TYPE "SongRole" AS ENUM ('OPENING', 'PRAISE', 'TRANSITION', 'RESPONSE', 'SPECIAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SCREENSHOT', 'DOCX', 'PDF', 'IMAGE', 'VIDEO', 'EXPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('TRANSPOSE', 'FREESHOW_GENERATE', 'CAPTION_GENERATE', 'BACKGROUND_IMAGE_GENERATE', 'BACKGROUND_VIDEO_GENERATE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "OutputType" AS ENUM ('FREESHOW', 'DOCX', 'PDF', 'CAPTION_PACK', 'BACKGROUND_IMAGE', 'BACKGROUND_VIDEO', 'ZIP');

-- CreateEnum
CREATE TYPE "ServantGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ServantGroup" AS ENUM ('PASTORS', 'CHURCH_LEADERS', 'MENS', 'LADIES', 'YOUTH', 'TECH', 'MUSIC');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PAPInboxScreenshot" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "batchIndex" INTEGER NOT NULL,
    "batchTotal" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "note" TEXT,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PAPInboxScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorshipService" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "ministryName" TEXT NOT NULL,
    "ministryPresetCode" TEXT,
    "assignedMinistry" "AssignedMinistry",
    "sermonVerse" TEXT,
    "theme" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "serviceVariant" "ServiceVariant" NOT NULL DEFAULT 'STANDARD',
    "templateType" "ServiceTemplateType" NOT NULL DEFAULT 'REGULAR',
    "templatePresetCode" TEXT,
    "pledgeType" "PledgeType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorshipService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorshipServiceBlock" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "blockType" "BlockType" NOT NULL,
    "label" TEXT,
    "code" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorshipServiceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockPerson" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "personTitle" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BlockPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "defaultKey" TEXT,
    "bpm" INTEGER,
    "language" TEXT,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongFile" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongTagPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongTagPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantGroupPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantGroupPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "ServiceTemplatePreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "templateType" "ServiceTemplateType" NOT NULL,
    "optionalBlocks" "BlockType"[],
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTemplatePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorshipServiceSong" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "songRole" "SongRole" NOT NULL,
    "pageRef" TEXT,

    CONSTRAINT "WorshipServiceSong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorshipServiceDetail" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "blockId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "WorshipServiceDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBibleVerse" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "verse" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceBibleVerse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceServantAssignment" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "role" "ServiceServantRole" NOT NULL,
    "personName" TEXT NOT NULL,

    CONSTRAINT "ServiceServantAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceHymnal" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "role" "ServiceHymnalRole" NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "ServiceHymnal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAsset" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "jobType" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputJson" JSONB,
    "outputJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedOutput" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "jobId" TEXT,
    "type" "OutputType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "ServantGender",
    "group" "ServantGroup",
    "groupCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "PAPInboxScreenshot_createdAt_idx" ON "PAPInboxScreenshot"("createdAt");

-- CreateIndex
CREATE INDEX "PAPInboxScreenshot_batchId_createdAt_idx" ON "PAPInboxScreenshot"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "WorshipService_workspaceId_serviceDate_idx" ON "WorshipService"("workspaceId", "serviceDate");

-- CreateIndex
CREATE INDEX "Song_workspaceId_title_idx" ON "Song"("workspaceId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "SongTagPreset_workspaceId_token_key" ON "SongTagPreset"("workspaceId", "token");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryPreset_workspaceId_code_key" ON "MinistryPreset"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ServantGroupPreset_workspaceId_code_key" ON "ServantGroupPreset"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "ChecklistItemPreset_workspaceId_order_idx" ON "ChecklistItemPreset"("workspaceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTemplatePreset_workspaceId_code_key" ON "ServiceTemplatePreset"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "ServiceBibleVerse_serviceId_order_idx" ON "ServiceBibleVerse"("serviceId", "order");

-- CreateIndex
CREATE INDEX "ServiceServantAssignment_serviceId_idx" ON "ServiceServantAssignment"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceServantAssignment_serviceId_role_key" ON "ServiceServantAssignment"("serviceId", "role");

-- CreateIndex
CREATE INDEX "ServiceHymnal_serviceId_idx" ON "ServiceHymnal"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceHymnal_serviceId_role_key" ON "ServiceHymnal"("serviceId", "role");

-- CreateIndex
CREATE INDEX "AutomationJob_workspaceId_createdAt_idx" ON "AutomationJob"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedOutput_workspaceId_createdAt_idx" ON "GeneratedOutput"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Servant_workspaceId_name_idx" ON "Servant"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Servant_workspaceId_group_name_idx" ON "Servant"("workspaceId", "group", "name");

-- AddForeignKey
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipServiceBlock" ADD CONSTRAINT "WorshipServiceBlock_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockPerson" ADD CONSTRAINT "BlockPerson_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WorshipServiceBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongFile" ADD CONSTRAINT "SongFile_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongTagPreset" ADD CONSTRAINT "SongTagPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryPreset" ADD CONSTRAINT "MinistryPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantGroupPreset" ADD CONSTRAINT "ServantGroupPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemPreset" ADD CONSTRAINT "ChecklistItemPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplatePreset" ADD CONSTRAINT "ServiceTemplatePreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipServiceSong" ADD CONSTRAINT "WorshipServiceSong_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipServiceSong" ADD CONSTRAINT "WorshipServiceSong_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WorshipServiceBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipServiceSong" ADD CONSTRAINT "WorshipServiceSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipServiceDetail" ADD CONSTRAINT "WorshipServiceDetail_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipServiceDetail" ADD CONSTRAINT "WorshipServiceDetail_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WorshipServiceBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBibleVerse" ADD CONSTRAINT "ServiceBibleVerse_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceServantAssignment" ADD CONSTRAINT "ServiceServantAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceHymnal" ADD CONSTRAINT "ServiceHymnal_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAsset" ADD CONSTRAINT "ServiceAsset_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedOutput" ADD CONSTRAINT "GeneratedOutput_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedOutput" ADD CONSTRAINT "GeneratedOutput_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedOutput" ADD CONSTRAINT "GeneratedOutput_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutomationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep Prisma-owned tables private from Supabase's public Data API.
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PAPInboxScreenshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorshipService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorshipServiceBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlockPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Song" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SongFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SongTagPreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MinistryPreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServantGroupPreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItemPreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceTemplatePreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorshipServiceSong" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorshipServiceDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceBibleVerse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceServantAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceHymnal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedOutput" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Servant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
