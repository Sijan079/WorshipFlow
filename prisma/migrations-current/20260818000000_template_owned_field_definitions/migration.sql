ALTER TABLE "ServiceTemplateBlock"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "blockType" "BlockType" NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN IF NOT EXISTS "fieldDefinition" JSONB NOT NULL DEFAULT '{"fields":[]}';

ALTER TABLE "WorshipServiceBlock"
  ADD COLUMN IF NOT EXISTS "fieldDefinition" JSONB NOT NULL DEFAULT '{"fields":[]}';

ALTER TABLE "ServiceTemplateBlock"
  ALTER COLUMN "typeId" DROP NOT NULL,
  ALTER COLUMN "typeVersionId" DROP NOT NULL;

UPDATE "ServiceTemplateBlock" AS block
SET
  "fieldDefinition" = version."definition",
  "code" = type."key",
  "blockType" = CASE
    WHEN type."key" IN ('CALL_TO_WORSHIP', 'PRAISE_AND_WORSHIP', 'MC', 'AWIT_NG_HIMNO', 'TIPAN_PAHAYAG', 'AWIT_NG_PAKIKINIG', 'SCRIPTURE_READING', 'SERMON', 'AWIT_NG_PAGTUGON', 'OFFERING', 'FLOWERS_FOR_THE_LORD', 'DETAILS')
      THEN type."key"::"BlockType"
    ELSE 'CUSTOM'::"BlockType"
  END
FROM "ProgramBlockTypeVersion" AS version
JOIN "ProgramBlockType" AS type ON type."id" = version."typeId"
WHERE block."typeVersionId" = version."id";

UPDATE "WorshipServiceBlock" AS block
SET "fieldDefinition" = version."definition"
FROM "ProgramBlockTypeVersion" AS version
WHERE block."typeVersionId" = version."id";
