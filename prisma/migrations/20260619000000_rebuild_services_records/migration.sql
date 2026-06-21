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

-- AlterTable
ALTER TABLE "WorshipService"
ADD COLUMN "assignedMinistry" "AssignedMinistry",
ADD COLUMN "sermonVerse" TEXT,
ADD COLUMN "templateType" "ServiceTemplateType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN "pledgeType" "PledgeType";

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

-- AddForeignKey
ALTER TABLE "ServiceBibleVerse" ADD CONSTRAINT "ServiceBibleVerse_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceServantAssignment" ADD CONSTRAINT "ServiceServantAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceHymnal" ADD CONSTRAINT "ServiceHymnal_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
