import { reportServerFailure } from "./observability.ts";

type ErrorMessageOptions = {
  exposeInternal?: boolean;
  event?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestId?: string | null;
};

export function getErrorMessage(error: unknown, fallback: string, options?: ErrorMessageOptions) {
  reportServerFailure(error, {
    event: options?.event ?? "route.handler.failure",
    route: options?.route ?? "/api/unknown",
    method: options?.method,
    status: options?.status ?? 500,
    durationMs: options?.durationMs,
    requestId: options?.requestId,
    source: "route-handler",
  });

  if (options?.exposeInternal && error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
