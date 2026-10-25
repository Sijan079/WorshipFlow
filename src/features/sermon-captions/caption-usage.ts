export function usageUtcDay(at: Date) {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function usageUtcMonth(at: Date): [Date, Date] {
  return [new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)), new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1))];
}

export function meteredUsageDelta(meteredCharacters: number | null) {
  return meteredCharacters === null
    ? { meteredCharacters: 0, unmeteredRequests: 1 }
    : { meteredCharacters, unmeteredRequests: 0 };
}

export function summarizeCaptionUsage(
  rows: Array<{ day: Date; meteredCharacters: number; unmeteredRequests: number }>,
  at = new Date(),
) {
  const [start, end] = usageUtcMonth(at);
  return rows.reduce((total, row) => {
    if (row.day >= start && row.day < end) {
      total.meteredCharacters += row.meteredCharacters;
      total.unmeteredRequests += row.unmeteredRequests;
    }
    return total;
  }, { meteredCharacters: 0, unmeteredRequests: 0 });
}

export function totalCaptionUsage(
  baselineCharacters: number | null,
  appUsage: { meteredCharacters: number; unmeteredRequests: number },
) {
  const baseline = baselineCharacters ?? 0;
  return {
    baselineCharacters: baseline,
    appCharacters: appUsage.meteredCharacters,
    estimatedCharacters: baseline + appUsage.meteredCharacters,
    unmeteredRequests: appUsage.unmeteredRequests,
  };
}
