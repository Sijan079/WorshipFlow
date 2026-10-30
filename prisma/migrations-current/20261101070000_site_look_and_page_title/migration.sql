-- Additive only: a page can hide its title; the website settings gain the look (colour set, font style, logo), the
-- header button and the footer's service times. Every new column has a default or may be empty.
ALTER TABLE "SitePage" ADD COLUMN "showTitle" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SiteSettings" ADD COLUMN "colorSet" TEXT NOT NULL DEFAULT 'dawn';
ALTER TABLE "SiteSettings" ADD COLUMN "fontStyle" TEXT NOT NULL DEFAULT 'clean';
ALTER TABLE "SiteSettings" ADD COLUMN "logoPath" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "headerButtonLabel" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "headerButtonSlug" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "serviceTimes" TEXT;
