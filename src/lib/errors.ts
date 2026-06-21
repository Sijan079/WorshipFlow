export function getErrorMessage(error: unknown, fallback: string, options?: { exposeInternal?: boolean }) {
  if (options?.exposeInternal && error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
