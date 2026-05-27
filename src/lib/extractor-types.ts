import { z } from "zod";

export const EXTRACTOR_SOURCE_MODES = ["upload", "paste"] as const;
export const EXTRACTOR_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const EXTRACTOR_MODES = ["local", "ai_fallback"] as const;
export const EXTRACTOR_WARNING_CODES = [
  "variant_heading_detected",
  "directive_noise_detected",
  "repeated_restart_detected",
  "repeated_sections_detected",
  "truncated_output_detected",
  "sparse_output_detected",
  "unlabeled_lines_detected",
] as const;

export const LyricsExtractorUploadInputSchema = z.object({
  sourceMode: z.literal("upload"),
  batchId: z.string().min(1, "Batch ID is required"),
  songTitle: z.string().optional(),
  serviceSongId: z.string().uuid().optional(),
  songId: z.string().uuid().optional(),
});

export const LyricsExtractorPasteInputSchema = z.object({
  sourceMode: z.literal("paste"),
  pastedText: z.string().min(1, "Pasted text is required"),
  songTitle: z.string().optional(),
  serviceSongId: z.string().uuid().optional(),
  songId: z.string().uuid().optional(),
});

export const LyricsExtractorJobInputSchema = z.union([
  LyricsExtractorUploadInputSchema,
  LyricsExtractorPasteInputSchema,
]);

export const LyricsExtractorSafeInputSchema = z.object({
  sourceMode: z.enum(EXTRACTOR_SOURCE_MODES),
  hasSongContext: z.boolean(),
});

export const LyricsExtractorSafeOutputSchema = z.object({
  parser: z.enum(["docx", "pdf", "txt", "paste"]),
  extractedLineCount: z.number().int().nonnegative(),
  sectionCount: z.number().int().nonnegative(),
  normalizationApplied: z.boolean(),
  mode: z.enum(EXTRACTOR_MODES),
  confidence: z.enum(EXTRACTOR_CONFIDENCE_LEVELS),
  warningCodes: z.array(z.enum(EXTRACTOR_WARNING_CODES)),
  resultAvailable: z.boolean(),
});

export const LyricsExtractorAiRetryRequestSchema = z.object({
  retryToken: z.string().min(1, "Retry token is required"),
});

export const LyricsExtractorAiRetryDescriptorSchema = z.object({
  retryToken: z.string().min(1),
  confidence: z.enum(EXTRACTOR_CONFIDENCE_LEVELS),
  warningCodes: z.array(z.enum(EXTRACTOR_WARNING_CODES)),
  parser: z.enum(["docx", "pdf", "txt", "paste"]),
});

export const LyricsExtractorEditableResponseSchema = z.object({
  kind: z.literal("editable"),
  text: z.string(),
  retry: LyricsExtractorAiRetryDescriptorSchema.optional(),
  outputJson: LyricsExtractorSafeOutputSchema,
});

export const LyricsExtractorDocxRequestSchema = z.object({
  text: z.string().min(1, "Extracted lyrics are required"),
  songTitle: z.string().optional(),
});

export type LyricsExtractorJobInput = z.infer<typeof LyricsExtractorJobInputSchema>;
export type LyricsExtractorSafeInput = z.infer<typeof LyricsExtractorSafeInputSchema>;
export type LyricsExtractorSafeOutput = z.infer<typeof LyricsExtractorSafeOutputSchema>;
export type LyricsExtractorAiRetryRequest = z.infer<typeof LyricsExtractorAiRetryRequestSchema>;
export type LyricsExtractorAiRetryDescriptor = z.infer<typeof LyricsExtractorAiRetryDescriptorSchema>;
export type ExtractorConfidenceLevel = (typeof EXTRACTOR_CONFIDENCE_LEVELS)[number];
export type ExtractorWarningCode = (typeof EXTRACTOR_WARNING_CODES)[number];
export type ExtractorMode = (typeof EXTRACTOR_MODES)[number];
export type LyricsExtractorEditableResponse = z.infer<typeof LyricsExtractorEditableResponseSchema>;
export type LyricsExtractorDocxRequest = z.infer<typeof LyricsExtractorDocxRequestSchema>;

export type TemporaryAutomationFileDescriptor = {
  id: string;
  mimeType: string;
  size: number;
};

export type TemporaryAutomationBatchDescriptor = {
  id: string;
  serviceId: string;
  createdAt: string;
  expiresAt: string;
  files: TemporaryAutomationFileDescriptor[];
};

export type LyricsExtractorJobResponse = {
  job: {
    id: string;
    status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
    outputJson: LyricsExtractorSafeOutput | { error: string } | null;
  };
};
