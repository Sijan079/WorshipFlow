import { z } from "zod";

export const CommentCardNameTemplateSchema = z.object({
  name: z.string().trim().min(1).max(72),
});

export const ActivateCommentCardNameTemplateSchema = z.object({
  id: z.string().uuid(),
});
