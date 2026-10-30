-- Additive only: the Columns layout block. Its columns and the blocks in them are kept in the block's own JSON.
ALTER TYPE "SiteBlockType" ADD VALUE IF NOT EXISTS 'COLUMNS';
