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

// The monthly cap on translated characters per church. Azure's free allowance is two million, so that is
// the default; CAPTION_MONTHLY_CHARACTER_CAP overrides it.
export const DEFAULT_CHARACTER_CAP = 2_000_000;

export function parseCharacterCap(value: string | undefined) {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHARACTER_CAP;
}

// ok below 80%, warning from 80%, blocked at 100%. Blocked only stops a new session from starting;
// a session already running is never cut off by it.
export function captionBudget(used: number, cap: number): { state: "ok" | "warning" | "blocked"; percent: number; used: number; cap: number } {
  const percent = Math.min(100, Math.floor((used / cap) * 100));
  const state = used >= cap ? "blocked" : used >= cap * 0.8 ? "warning" : "ok";
  return { state, percent, used, cap };
}
