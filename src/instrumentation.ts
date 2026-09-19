import type { Instrumentation } from "next";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { registerOTel } from "@vercel/otel";
import { reportServerFailure } from "@/lib/observability";

export function register() {
  const metricsEndpoint =
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const metricReaders = metricsEndpoint
    ? [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
          exportIntervalMillis: 60_000,
        }),
      ]
    : [];

  registerOTel({ serviceName: "worship-flow", metricReaders });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const requestIdHeader = request.headers["x-vercel-id"] ?? request.headers["x-request-id"];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

  reportServerFailure(error, {
    event: "next.request.unhandled",
    route: context.routePath,
    method: request.method,
    status: 500,
    requestId,
    source: context.routeType,
  });
};
