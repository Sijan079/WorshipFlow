-- The block list changed after the editor was designed (docs/changes/20261030.md item 10). No page has been saved
-- yet, so the enum is rebuilt: RICH_TEXT is replaced by PARAGRAPH and the new block types are added. If a row
-- still used the old value, the cast below fails and nothing is changed.
ALTER TABLE "SitePageBlock" ALTER COLUMN "type" TYPE TEXT;

DROP TYPE "SiteBlockType";

CREATE TYPE "SiteBlockType" AS ENUM ('PARAGRAPH', 'HEADING', 'LIST', 'QUOTE', 'IMAGE', 'BUTTON', 'SPACER', 'ANNOUNCEMENTS_LIST', 'EVENTS_LIST', 'SERVICE_TIMES', 'CONTACT');

ALTER TABLE "SitePageBlock" ALTER COLUMN "type" TYPE "SiteBlockType" USING "type"::"SiteBlockType";

ALTER TABLE "SitePage" ADD COLUMN "description" TEXT;
