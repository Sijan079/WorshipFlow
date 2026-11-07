// One browser-console line per microphone event on the booth PC. Open DevTools (F12) and filter for
// "captions.mic". Only the error name and counts are logged, never audio or device ids.
export function logMic(event: string, detail: Record<string, unknown> = {}, error?: unknown) {
  const errorName = error instanceof Error ? error.name : error ? "UnknownError" : undefined;
  const line = { event: `captions.mic.${event}`, ...detail, ...(errorName ? { error: errorName, message: (error as Error).message } : {}) };
  if (errorName) console.warn(JSON.stringify(line));
  else console.info(JSON.stringify(line));
}
