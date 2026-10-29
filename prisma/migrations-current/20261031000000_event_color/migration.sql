-- Additive only: the colour an event shows in the calendar, one of a fixed set of names.
-- DEFAULT is the usual blue, so every event that exists today keeps its current look.
ALTER TABLE "ChurchEvent" ADD COLUMN "color" TEXT NOT NULL DEFAULT 'DEFAULT';
