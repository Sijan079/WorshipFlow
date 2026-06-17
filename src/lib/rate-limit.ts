import { NextResponse } from "next/server";
import { checkRateLimitBucket } from "./rate-limit-store";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function getRateLimitKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `${scope}:${forwardedFor || realIp || "unknown"}`;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  return checkRateLimitBucket({ key, limit, windowMs });
}

export function rateLimitResponse(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
