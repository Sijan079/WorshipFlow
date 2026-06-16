import { z } from "zod";

export const backgroundPurposes = [
  "lyrics",
  "sermon",
  "scripture",
  "offering",
  "announcements",
  "general-worship",
] as const;

export const backgroundMoods = [
  "reverent",
  "joyful",
  "reflective",
  "hopeful",
  "quiet",
  "celebration",
] as const;

export const backgroundVisualStyles = [
  "abstract-light",
  "soft-landscape",
  "stained-glass",
  "minimal-texture",
  "warm-stage-wash",
  "atmospheric-clouds",
] as const;

export const backgroundTextSafeAreas = [
  "center-clear",
  "lower-third-clear",
  "full-frame",
] as const;

export type BackgroundMediaType = "image" | "video";
export type BackgroundPurpose = (typeof backgroundPurposes)[number];
export type BackgroundMood = (typeof backgroundMoods)[number];
export type BackgroundVisualStyle = (typeof backgroundVisualStyles)[number];
export type BackgroundTextSafeArea = (typeof backgroundTextSafeAreas)[number];

const BackgroundGenerationSchema = z
  .object({
    mediaType: z.literal("image", {
      error: "Image backgrounds only. Video generation is temporarily disabled.",
    }),
    purpose: z.enum(backgroundPurposes),
    mood: z.enum(backgroundMoods, {
      error: "Mood is required.",
    }),
    visualStyle: z.enum(backgroundVisualStyles, {
      error: "Style is required.",
    }),
    textSafeArea: z.enum(backgroundTextSafeAreas),
    promptDetails: z.string().trim().max(500, "Prompt details must be 500 characters or fewer.").optional(),
    durationSeconds: z.number().int().optional(),
    videoQuality: z.enum(["480p"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.durationSeconds !== undefined || value.videoQuality !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["mediaType"],
        message: "Image backgrounds cannot include video duration or quality.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    format: "presentation-16:9" as const,
    providerResolution: "1920x1080",
    promptDetails: value.promptDetails || undefined,
  }));

export type BackgroundGenerationRequest = z.infer<typeof BackgroundGenerationSchema>;

export type BackgroundGenerationEstimate = {
  provider: "openai";
  model: string;
  mediaType: BackgroundMediaType;
  format: "presentation-16:9";
  providerResolution: string;
  durationSeconds: number | null;
  videoQuality: "480p" | null;
  seamlessLoop: boolean;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  estimatedCostUsd: number;
  pricingSnapshot: string;
  freeTierNote: string;
};

const labelMaps = {
  purpose: {
    lyrics: "song lyric background",
    sermon: "sermon background",
    scripture: "scripture reading background",
    offering: "offering background",
    announcements: "announcements background",
    "general-worship": "general worship background",
  },
  mood: {
    reverent: "reverent",
    joyful: "joyful",
    reflective: "reflective",
    hopeful: "hopeful",
    quiet: "quiet",
    celebration: "celebratory",
  },
  visualStyle: {
    "abstract-light": "abstract light",
    "soft-landscape": "soft landscape",
    "stained-glass": "subtle stained glass",
    "minimal-texture": "minimal texture",
    "warm-stage-wash": "warm stage wash",
    "atmospheric-clouds": "atmospheric clouds",
  },
  textSafeArea: {
    "center-clear": "leave the center visually calm and clear",
    "lower-third-clear": "leave the lower third visually calm and clear",
    "full-frame": "keep the full frame calm enough for worship overlays",
  },
} satisfies Record<string, Record<string, string>>;

export function parseBackgroundGenerationRequest(input: unknown) {
  return BackgroundGenerationSchema.parse(input);
}

export function estimateBackgroundGeneration(
  request: BackgroundGenerationRequest,
  models: { imageModel?: string; estimatedImageCostUsd?: number } = {}
): BackgroundGenerationEstimate {
  return {
    provider: "openai",
    model: models.imageModel || "gpt-image-1",
    mediaType: request.mediaType,
    format: request.format,
    providerResolution: "1536x1024",
    durationSeconds: null,
    videoQuality: null,
    seamlessLoop: false,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
    estimatedCostUsd: models.estimatedImageCostUsd ?? 0.04,
    pricingSnapshot: "OpenAI image pricing is token-based and should be reconciled against the OpenAI usage dashboard.",
    freeTierNote: "Image generation uses the configured OpenAI project and incurs API usage charges.",
  };
}

export function buildBackgroundPrompt(request: BackgroundGenerationRequest) {
  const purpose = labelMaps.purpose[request.purpose];
  const mood = labelMaps.mood[request.mood];
  const visualStyle = labelMaps.visualStyle[request.visualStyle];
  const textSafeArea = labelMaps.textSafeArea[request.textSafeArea];

  const base = [
    `Create a ${request.format} ${purpose} for worship presentation use.`,
    `Mood: ${mood}.`,
    `Visual style: ${visualStyle}.`,
    textSafeArea,
    "No text, no logos, no identifiable people, no celebrity likeness, no copyrighted characters.",
    "No political campaign imagery, violent content, sexual content, or manipulative content.",
    "Keep the image calm enough for lyrics, scripture, or service information overlays.",
  ];

  if (request.promptDetails) {
    base.push(`User direction: ${request.promptDetails}`);
  }

  return base.join(" ");
}

export function assertAcceptedEstimateMatches(
  accepted: unknown,
  estimate: BackgroundGenerationEstimate
) {
  const acceptedEstimate = z
    .object({
      mediaType: z.enum(["image", "video"]),
      providerResolution: z.string(),
      durationSeconds: z.number().nullable(),
      videoQuality: z.enum(["480p"]).nullable(),
      estimatedCostUsd: z.number(),
    })
    .parse(accepted);

  return (
    acceptedEstimate.mediaType === estimate.mediaType &&
    acceptedEstimate.providerResolution === estimate.providerResolution &&
    acceptedEstimate.durationSeconds === estimate.durationSeconds &&
    acceptedEstimate.videoQuality === estimate.videoQuality &&
    acceptedEstimate.estimatedCostUsd === estimate.estimatedCostUsd
  );
}
