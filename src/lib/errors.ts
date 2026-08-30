export function getErrorMessage(error: unknown, fallback: string, options?: { exposeInternal?: boolean }) {
  console.error("Route handler failed.", error);

  if (options?.exposeInternal && error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
