ALTER TABLE "WorshipServiceBlock" ADD COLUMN "label" TEXT;
ALTER TABLE "WorshipServiceBlock" ADD COLUMN "code" TEXT;
ALTER TABLE "ServiceTemplatePreset" ADD COLUMN "blocks" JSONB NOT NULL DEFAULT '[]';
