import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import type { BackgroundMediaType } from "../media-generation";

type LimitEnv = {
  MEDIA_GENERATION_IMAGE_HOURLY_LIMIT?: number;
  MEDIA_GENERATION_IMAGE_DAILY_LIMIT?: number;
  MEDIA_GENERATION_VIDEO_HOURLY_LIMIT?: number;
  MEDIA_GENERATION_VIDEO_DAILY_LIMIT?: number;
};

export function checkMediaGenerationRateLimits(params: {
  request: Request;
  workspaceId: string;
  mediaType: BackgroundMediaType;
  env: LimitEnv;
}) {
  const prefix = `${params.workspaceId}:${params.mediaType}`;
  const clientKey = getRateLimitKey(params.request, `media-generation:${prefix}`);
  const hourlyLimit =
    params.mediaType === "video"
      ? params.env.MEDIA_GENERATION_VIDEO_HOURLY_LIMIT ?? 1
      : params.env.MEDIA_GENERATION_IMAGE_HOURLY_LIMIT ?? 5;
  const dailyLimit =
    params.mediaType === "video"
      ? params.env.MEDIA_GENERATION_VIDEO_DAILY_LIMIT ?? 3
      : params.env.MEDIA_GENERATION_IMAGE_DAILY_LIMIT ?? 25;

  const hourly = checkRateLimit({
    key: `${clientKey}:hour`,
    limit: hourlyLimit,
    windowMs: 60 * 60 * 1000,
  });

  if (!hourly.allowed) {
    return hourly;
  }

  return checkRateLimit({
    key: `${clientKey}:day`,
    limit: dailyLimit,
    windowMs: 24 * 60 * 60 * 1000,
  });
}
