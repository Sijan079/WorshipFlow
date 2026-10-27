// Timing helpers for finding where the delay is between someone speaking and a listener reading it.
// Pure, so the booth, the server and the listener script share them and they can be tested.

export type StageMs = Record<string, number>;

const round1 = (value: number) => Math.round(value * 10) / 10;

// Marks how long each step took since the last mark, and the total since it was created.
export function createStageTimer(now: () => number = () => performance.now()) {
  const start = now();
  let last = start;
  const stages: StageMs = {};
  return {
    mark(name: string) {
      const current = now();
      stages[name] = round1(current - last);
      last = current;
    },
    summary(): StageMs {
      return { ...stages, total: round1(now() - start) };
    },
  };
}

// The standard header, so a browser's developer tools show the same numbers: "access;dur=12.3, ...".
export function serverTimingHeader(stages: StageMs) {
  return Object.entries(stages).map(([name, ms]) => `${name};dur=${ms}`).join(", ");
}

// How long the recogniser took: time since the audio began, minus how far into the audio the words end.
// Deepgram reports `start` and `duration` in seconds from the start of the audio. Never negative.
export function recognitionLagMs({ streamElapsedMs, start, duration }: { streamElapsedMs: number; start: number | undefined; duration: number | undefined }) {
  if (typeof start !== "number" || typeof duration !== "number") return undefined;
  return Math.max(0, Math.round(streamElapsedMs - (start + duration) * 1000));
}

export type Summary = { count: number; min: number; median: number; p95: number; max: number; mean: number };

// The middle value and the slow end matter more than the average, so both are reported.
export function summarize(values: number[]): Summary | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { count: sorted.length, min: sorted[0], median: round1(median), p95, max: sorted[sorted.length - 1], mean: round1(mean) };
}
