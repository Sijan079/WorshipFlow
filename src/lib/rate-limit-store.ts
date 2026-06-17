type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function pruneExpiredRateLimitBuckets(now = Date.now()) {
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function clearRateLimitBuckets() {
  buckets.clear();
}

export function getRateLimitBucketCount() {
  return buckets.size;
}

export function checkRateLimitBucket(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  pruneExpiredRateLimitBuckets(now);
  const current = buckets.get(params.key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + params.windowMs;
    buckets.set(params.key, { count: 1, resetAt });
    return { allowed: true, remaining: params.limit - 1, resetAt };
  }

  current.count += 1;
  return {
    allowed: current.count <= params.limit,
    remaining: Math.max(0, params.limit - current.count),
    resetAt: current.resetAt,
  };
}
