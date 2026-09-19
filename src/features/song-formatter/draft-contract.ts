import { z } from "zod";
import { DraftSchema } from "./recovery.ts";

export const DraftContentSchema = DraftSchema.omit({ version: true });
export const DraftRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("legacy"), content: DraftContentSchema }),
  z.object({ action: z.enum(["resume", "takeover", "heartbeat", "release", "clear"]), conversionId: z.string().uuid(), sessionId: z.string().uuid() }),
  z.object({ action: z.literal("save"), conversionId: z.string().uuid(), sessionId: z.string().uuid(),
    revision: z.number().int().nonnegative(), content: DraftContentSchema }),
]);
export type DraftContent = z.infer<typeof DraftContentSchema>;
export type DraftCommand = z.infer<typeof DraftRequestSchema>;
export type ConversionSummary = {
  id: string; songTitle: string; sourceName: string; parser: string; createdAt: string;
  status: "Draft" | "Done" | "Failed"; expiresAt: string | null; open: boolean;
  lastTouchedAt: string;
  lastTouchedBy: { displayName: string | null };
};
export type ServerDraft = {
  conversionId: string; content: DraftContent; revision: number; sessionId: string | null;
  expiresAt: string | null; lastSeenAt: string;
};
export type DraftResponse = { history: ConversionSummary[]; draft: ServerDraft | null; serverNow: string };
