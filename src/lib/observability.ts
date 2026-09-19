import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";


export type FailureContext = {
  event: string;
  route: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestId?: string | null;
  source?: string;
};

type TraceContext = {
  traceId?: string;
  spanId?: string;
};

function redact(value: string) {
  return value
    .replace(/\b(?:postgres(?:ql)?|https?):\/\/[^@\s/]+@/gi, (match) => {
      const scheme = match.slice(0, match.indexOf("://") + 3);
      return `${scheme}[REDACTED]@`;
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .slice(0, 500);
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: redact(error.name || "Error"),
      message: redact(error.message || "An error occurred."),
    };
  }

  return {
    name: "UnknownError",
    message: "A non-Error value was thrown.",
  };
}

export function createFailureLogRecord(
  error: unknown,
  context: FailureContext,
  traceContext: TraceContext = {},
) {
  const status =
    typeof context.status === "number" && Number.isInteger(context.status) ? context.status : 500;
  const durationMs =
    typeof context.durationMs === "number" && Number.isFinite(context.durationMs) && context.durationMs >= 0
      ? context.durationMs
      : undefined;

  return {
    timestamp: new Date().toISOString(),
    level: status >= 500 ? ("error" as const) : ("warn" as const),
    event: context.event,
    route: context.route,
    ...(context.method ? { method: context.method } : {}),
    status,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(context.requestId ? { requestId: redact(context.requestId) } : {}),
    ...(context.source ? { source: context.source } : {}),
    ...(traceContext.traceId ? { traceId: traceContext.traceId } : {}),
    ...(traceContext.spanId ? { spanId: traceContext.spanId } : {}),
    error: safeError(error),
    metric: {
      name: "worship_flow_failures_total",
      value: 1,
    },
  };
}

export function reportServerFailure(error: unknown, context: FailureContext) {
  // Resolve instruments after instrumentation has registered the provider.
  const meter = metrics.getMeter("worship-flow");
  const failureCounter = meter.createCounter("worship_flow_failures_total");
  const failureDuration = meter.createHistogram("worship_flow_failure_duration_ms", { unit: "ms" });
  const activeSpan = trace.getActiveSpan();
  const span = activeSpan ?? trace.getTracer("worship-flow").startSpan(context.event);
  const spanContext = span?.spanContext();
  const record = createFailureLogRecord(error, context, {
    traceId: spanContext?.traceId,
    spanId: spanContext?.spanId,
  });
  const metricAttributes = {
    "failure.event": context.event,
    "http.route": context.route,
    "http.response.status_code": record.status,
  };

  failureCounter.add(1, metricAttributes);
  if (record.durationMs !== undefined) {
    failureDuration.record(record.durationMs, metricAttributes);
  }

  if (span) {
    const sanitized = new Error(record.error.message);
    sanitized.name = record.error.name;
    span.recordException(sanitized);
    span.setAttributes({
      "app.failure.event": context.event,
      "http.route": context.route,
      "http.response.status_code": record.status,
      ...(context.method ? { "http.request.method": context.method } : {}),
      ...(context.requestId ? { "app.request.id": redact(context.requestId) } : {}),
    });
    if (record.status >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: record.error.message });
    }
  }

  const serialized = JSON.stringify(record);
  if (record.level === "error") {
    console.error(serialized);
  } else {
    console.warn(serialized);
  }
  if (!activeSpan) span.end();
}

export function reportRouteFailure(
  error: unknown,
  context: {
    route: string;
    method: string;
    status?: number;
    request?: Request;
    durationMs?: number;
    event?: string;
  },
) {
  reportServerFailure(error, {
    event: context.event ?? "route.handler.failure",
    route: context.route,
    method: context.method,
    status: context.status ?? 500,
    durationMs: context.durationMs,
    requestId:
      context.request?.headers.get("x-vercel-id") ??
      context.request?.headers.get("x-request-id"),
    source: "route-handler",
  });
}
