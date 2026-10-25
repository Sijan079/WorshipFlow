-- CreateEnum
CREATE TYPE "ChurchEventStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventRecurrenceKind" AS ENUM ('NONE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "EventOccurrenceStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventRegistrationProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'OTHER');

-- CreateEnum
CREATE TYPE "EventAnnouncementStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WorkspaceModule" AS ENUM ('EVENTS', 'ANNOUNCEMENTS');

-- CreateEnum
CREATE TYPE "WorkspaceAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'ATTENDANCE', 'DRAFT', 'PUBLISH');

-- CreateTable
CREATE TABLE "ChurchEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT,
    "timezone" TEXT NOT NULL,
    "status" "ChurchEventStatus" NOT NULL DEFAULT 'DRAFT',
    "recurrence" "EventRecurrenceKind" NOT NULL DEFAULT 'NONE',
    "weeklyDay" INTEGER,
    "weeklyStartLocal" TEXT,
    "weeklyEndLocal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchEventOccurrence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "EventOccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "changeNote" TEXT,
    "registrationUrl" TEXT,
    "registrationProvider" "EventRegistrationProvider",
    "responseCount" INTEGER,
    "yesCount" INTEGER,
    "noCount" INTEGER,
    "attendanceCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchEventOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventVisitor" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAnnouncement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceId" TEXT,
    "sharedDraft" TEXT NOT NULL DEFAULT '',
    "facebookContent" TEXT,
    "instagramContent" TEXT,
    "status" "EventAnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceActionGrant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "WorkspaceModule" NOT NULL,
    "action" "WorkspaceAction" NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceActionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChurchEvent_workspaceId_status_createdAt_idx" ON "ChurchEvent"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ChurchEventOccurrence_eventId_startsAt_idx" ON "ChurchEventOccurrence"("eventId", "startsAt");

-- CreateIndex
CREATE INDEX "ChurchEventOccurrence_localDate_idx" ON "ChurchEventOccurrence"("localDate");

-- CreateIndex
CREATE INDEX "ChurchEventOccurrence_startsAt_endsAt_idx" ON "ChurchEventOccurrence"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "EventVisitor_occurrenceId_createdAt_idx" ON "EventVisitor"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "EventAnnouncement_eventId_createdAt_idx" ON "EventAnnouncement"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceActionGrant_workspaceId_module_action_idx" ON "WorkspaceActionGrant"("workspaceId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceActionGrant_workspaceId_userId_module_action_key" ON "WorkspaceActionGrant"("workspaceId", "userId", "module", "action");

-- AddForeignKey
ALTER TABLE "ChurchEvent" ADD CONSTRAINT "ChurchEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchEventOccurrence" ADD CONSTRAINT "ChurchEventOccurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChurchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVisitor" ADD CONSTRAINT "EventVisitor_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "ChurchEventOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAnnouncement" ADD CONSTRAINT "EventAnnouncement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChurchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAnnouncement" ADD CONSTRAINT "EventAnnouncement_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "ChurchEventOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceActionGrant" ADD CONSTRAINT "WorkspaceActionGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceActionGrant" ADD CONSTRAINT "WorkspaceActionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceActionGrant" ADD CONSTRAINT "WorkspaceActionGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChurchEvent" ADD CONSTRAINT "ChurchEvent_weekly_schedule_check" CHECK (
    ("recurrence" = 'NONE' AND "weeklyDay" IS NULL AND "weeklyStartLocal" IS NULL AND "weeklyEndLocal" IS NULL)
    OR ("recurrence" = 'WEEKLY' AND "weeklyDay" BETWEEN 0 AND 6 AND "weeklyStartLocal" IS NOT NULL AND "weeklyEndLocal" IS NOT NULL)
);

ALTER TABLE "ChurchEventOccurrence" ADD CONSTRAINT "ChurchEventOccurrence_time_check" CHECK ("startsAt" < "endsAt");
ALTER TABLE "ChurchEventOccurrence" ADD CONSTRAINT "ChurchEventOccurrence_counts_check" CHECK (
    ("responseCount" IS NULL OR "responseCount" >= 0)
    AND ("yesCount" IS NULL OR "yesCount" >= 0)
    AND ("noCount" IS NULL OR "noCount" >= 0)
    AND ("attendanceCount" IS NULL OR "attendanceCount" >= 0)
    AND ("responseCount" IS NULL OR COALESCE("yesCount", 0) + COALESCE("noCount", 0) <= "responseCount")
);

-- Browser clients do not access these Prisma-owned tables through the Supabase Data API.
ALTER TABLE "ChurchEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChurchEventOccurrence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventVisitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventAnnouncement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceActionGrant" ENABLE ROW LEVEL SECURITY;
