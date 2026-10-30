import { z } from "zod";
import { PageInputSchema, SITE_LIMITS, SiteBlockSchema } from "../blocks/block-validation.ts";

const title = z.string().trim().min(1, "Enter a page title.").max(SITE_LIMITS.titleMax);
const description = z.string().trim().max(SITE_LIMITS.descriptionMax);

// A page is always created as a draft. Publishing is a separate change that needs the Publish permission.
export const CreatePageSchema = z.strictObject({
  title,
  description: description.optional(),
  // Start from the ready-made home page (only offered for the first page of a church).
  starter: z.boolean().optional(),
  blocks: PageInputSchema.shape.blocks.optional(),
});

export const UpdatePageSchema = z.strictObject({
  title: title.optional(),
  description: description.optional(),
  blocks: z.array(SiteBlockSchema).max(SITE_LIMITS.blocksPerPage).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  isPublic: z.boolean().optional(),
});
