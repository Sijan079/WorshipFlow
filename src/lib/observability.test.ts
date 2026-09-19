import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createFailureLogRecord, reportServerFailure } from "./observability.ts";
import { metrics, trace, SpanStatusCode } from "@opentelemetry/api";
import { InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader, AggregationTemporality } from "@opentelemetry/sdk-metrics";

test("failures emit real metrics after late registration and annotate the active span", async (t) => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
  const provider = new MeterProvider({ readers: [reader] });
  metrics.setGlobalMeterProvider(provider);
  const exceptions: unknown[] = [];
  const statuses: unknown[] = [];
  const span = trace.wrapSpanContext({ traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 1 });
  t.mock.method(span, "recordException", (error: unknown) => { exceptions.push(error); });
  t.mock.method(span, "setStatus", (status: unknown) => { statuses.push(status); return span; });
  t.mock.method(trace, "getActiveSpan", () => span);
  const logs: string[] = [];
  t.mock.method(console, "error", (line: string) => { logs.push(line); });
  try {
    reportServerFailure(new Error("Bearer secret-token"), { event: "test.failure", route: "/api/test", status: 503, durationMs: 12 });
    await provider.forceFlush();
    const collected = exporter.getMetrics().flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
    const counter = collected.find((metric) => metric.descriptor.name === "worship_flow_failures_total");
    assert.equal(counter?.dataPoints[0]?.value, 1);
    assert.equal(counter?.dataPoints[0]?.attributes["http.response.status_code"], 503);
    assert.ok(collected.some((metric) => metric.descriptor.name === "worship_flow_failure_duration_ms"));
    assert.equal(exceptions.length, 1);
    assert.equal((exceptions[0] as Error).message, "Bearer [REDACTED]");
    assert.deepEqual(statuses, [{ code: SpanStatusCode.ERROR, message: "Bearer [REDACTED]" }]);
    assert.equal(JSON.parse(logs[0]).traceId, "a".repeat(32));
  } finally {
    await provider.shutdown();
    metrics.disable();
  }
});

test("failure records keep operational context and redact sensitive error details", () => {
  const record = createFailureLogRecord(
    new Error(
      "Database failed for worship.leader@example.com with Bearer top-secret-token at postgres://admin:password@db.example.com/worship",
    ),
    {
      event: "song_formatter.draft.failure",
      route: "/api/song-formatter/draft",
      method: "POST",
      status: 500,
      requestId: "request-123",
      source: "route-handler",
    },
    {
      traceId: "trace-123",
      spanId: "span-123",
    },
  );

  assert.equal(record.level, "error");
  assert.equal(record.event, "song_formatter.draft.failure");
  assert.equal(record.route, "/api/song-formatter/draft");
  assert.equal(record.method, "POST");
  assert.equal(record.status, 500);
  assert.equal(record.requestId, "request-123");
  assert.equal(record.traceId, "trace-123");
  assert.equal(record.spanId, "span-123");
  assert.equal(record.metric.name, "worship_flow_failures_total");
  assert.equal(record.metric.value, 1);
  assert.match(record.error.message, /\[REDACTED_EMAIL\]/);
  assert.match(record.error.message, /Bearer \[REDACTED\]/);
  assert.match(record.error.message, /postgres:\/\/\[REDACTED\]@db\.example\.com\/worship/);
  assert.doesNotMatch(JSON.stringify(record), /top-secret-token|admin:password|worship\.leader@example\.com/);
});

test("client failures are warning records and reject unbounded context", () => {
  const record = createFailureLogRecord(new SyntaxError("Malformed input"), {
    event: "request.validation.failure",
    route: "/api/example",
    method: "POST",
    status: 400,
    durationMs: Number.POSITIVE_INFINITY,
  });

  assert.equal(record.level, "warn");
  assert.equal(record.durationMs, undefined);
  assert.equal(record.requestId, undefined);
});

test("API route catches use centralized failure telemetry", () => {
  const routeRoot = join(process.cwd(), "src", "app", "api");
  const routeFiles: string[] = [];
  const visit = (target: string) => {
    if (statSync(target).isDirectory()) {
      for (const entry of readdirSync(target)) visit(join(target, entry));
    } else if (target.endsWith("route.ts")) {
      routeFiles.push(target);
    }
  };
  visit(routeRoot);

  const uncovered = routeFiles
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => /catch\s*(?:\([^)]*\))?\s*\{/.test(source))
    .filter(
      ({ source }) =>
        !/getErrorMessage|reportRouteFailure|reportServerFailure/.test(source),
    )
    .map(({ file }) => file);
  const directConsoleFailures = routeFiles
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => /console\.(?:error|warn)\s*\(/.test(source))
    .map(({ file }) => file);

  assert.deepEqual(uncovered, []);
  assert.deepEqual(directConsoleFailures, []);
});
