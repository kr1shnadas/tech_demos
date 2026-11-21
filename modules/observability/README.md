<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Krishna Das
See NOTICE at the repository root.
-->

# Observability

A request that crosses two services used to leave me with one log line and no way to find the other. The ids did not match, and the trace stopped at the process boundary. This module is the slice I put on the next service: one config object, traces that follow the call, JSON logs that carry the same ids, and a metrics endpoint Prometheus can scrape.

## Setup

From this directory, with Node.js 20 or newer and Docker:

```bash
docker compose up --build
```

Open http://localhost:3000.

| Control | What you see |
| --- | --- |
| Normal | The catalog answers at once. The row shows the request id and a link to the trace. |
| Slow | The catalog waits, then answers. Latency on the dashboard moves. |
| Failing | The catalog returns an error. Both services count it. |

| Surface | URL |
| --- | --- |
| Page and gateway | http://localhost:3000 |
| Catalog | http://localhost:3001 |
| Grafana | http://localhost:3002 |
| Jaeger | http://localhost:16686 |
| Prometheus | http://localhost:9090 |
| Alert rules | http://localhost:9090/rules |

Grafana opens the Study checks dashboard. Anonymous view is on, so there is no sign-in. Jaeger lists `study-gateway` and `study-catalog`. A trace from the page link shows the gateway span and the catalog span on the same trace.

The page is served by the gateway. Prometheus scrapes `GET /metrics` on both services. Logs are JSON on stdout (`docker compose logs gateway catalog`).

To work on the page without rebuilding the image, leave the collector, Jaeger, Prometheus and Grafana up and run the three processes from the repository root:

```bash
docker compose -f modules/observability/docker-compose.yml up -d otel-collector jaeger prometheus grafana
pnpm install
pnpm --filter @krishnadas/observability dev
```

| Process | URL |
| --- | --- |
| Catalog | http://127.0.0.1:3001 |
| Gateway | http://127.0.0.1:3000 |
| React page | http://127.0.0.1:5173 |

The page proxies `/api` to the gateway. Copy `.env.example` to `.env` in this directory when you want a different exporter or log level. Values already set in the environment win over the file.

Tests, from the repository root:

```bash
pnpm --filter @krishnadas/observability test
```

Stop the demo with `docker compose down` from this directory.

## Usage

The package name is `@krishnadas/observability`. It is a private workspace package, so it is not on a public registry. In another package in this repository, depend on it and install from the root:

```json
{
  "dependencies": {
    "@krishnadas/observability": "workspace:*"
  }
}
```

```bash
pnpm install
```

Node.js 20 or newer. The export map points at `src/index.ts`, so the project that imports it has to compile that TypeScript. The demo uses `tsx`.

To use the module in a different repository, copy `modules/observability` and point the dependency at that folder (`workspace:*` or `file:`). Keep the license header on the copied files, and keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) with the copy.

Import from `@krishnadas/observability`. `defineObservabilityConfig` merges overrides onto the defaults. Nested objects merge field by field, so setting `tracing.samplingRatio` keeps the other tracing fields. `loadObservabilityConfig()` does the same from the environment, and reads a `.env` file in the working directory when one is present. Values already set in the environment win over that file.

`ObservabilityModule.register(config, options?)` takes the config and an optional `{ logDestination }`. Leave `logDestination` unset and JSON lines go to stdout. Call `startTracing(config)` before the process listens, and before Nest creates the app. That registers the HTTP instrumentation, so incoming requests and outgoing `http`, `https` and fetch calls pick up a span and send `traceparent`. `startTracing` returns a handle with `shutdown()`. Call it when the process exits. A second call returns the handle already started. When `tracing.enabled` is false, the handle does nothing.

```ts
import { Inject, Injectable, Module, type OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  HealthService,
  OBSERVABILITY_LOGGER,
  ObservabilityModule,
  defineObservabilityConfig,
  startTracing,
  type AppLogger,
} from "@krishnadas/observability";

const observabilityConfig = defineObservabilityConfig({
  serviceName: "study-gateway",
  tracing: { samplingRatio: 0.2 },
  logging: { level: "info" },
});

const tracing = startTracing(observabilityConfig);

@Injectable()
class CatalogReady implements OnModuleInit {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  onModuleInit(): void {
    this.health.add("catalog", async () => ({ ok: true }));
  }
}

@Module({
  imports: [ObservabilityModule.register(observabilityConfig)],
  providers: [CatalogReady],
})
export class AppModule {}

const app = await NestFactory.create(AppModule, { logger: false });
app.enableShutdownHooks();
await app.listen(3000);
app.get<AppLogger>(OBSERVABILITY_LOGGER).info({ port: 3000 }, "listening");
process.once("SIGTERM", () => {
  void tracing.shutdown();
});
```

Inject the logger with `@Inject(OBSERVABILITY_LOGGER)`. It is a pino logger. `logger.info({ port }, "listening")` writes one JSON line, with `service` and, during a request, `requestId`, `traceId` and `spanId`.

`HealthService.add(name, check)` registers a readiness check. `check` returns `{ ok: boolean }`. The check in the sample always reports ok. Return `{ ok: false }` when a dependency is down, and readiness answers 503. With no checks registered, the process is ready as soon as it is up. Liveness does not run the checks. The gateway demo checks that the catalog's liveness path answers, and it does not call the catalog from liveness itself.

`MetricsRegistry.recordStudyCheck(result)` increments `study_checks_total{result="ok"|"slow"|"error"}`. The catalog demo calls it. HTTP traffic under `/api` increments `http_requests_total`, `http_errors_total` (status 500 and above) and `http_request_duration_seconds`. Health and metrics scrapes are left out of those series so the dashboard is the API, not the scraper.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `serviceName` | `string` | `observability` | Service name on traces, logs and the Prometheus `service` label |
| `serviceVersion` | `string` | `0.1.0` | Service version on traces |
| `tracing.enabled` | `boolean` | `true` | Turn tracing and HTTP instrumentation on or off |
| `tracing.exporterEndpoint` | `string` | `http://localhost:4318/v1/traces` | OTLP HTTP endpoint, including the path |
| `tracing.samplingRatio` | `number` | `1` | Fraction of root spans to keep, from 0 to 1. A sampled parent keeps its children |
| `logging.enabled` | `boolean` | `true` | Turn JSON logging on or off |
| `logging.level` | `"fatal" \| "error" \| "warn" \| "info" \| "debug" \| "trace" \| "silent"` | `"info"` | pino level. `"silent"` drops every line |
| `logging.redactFields` | `readonly string[]` | `password`, `authorization`, `token`, `secret`, `apiKey`, `api_key`, `cookie`, `set-cookie` | Object keys replaced with `[redacted]`. Matching ignores case. Setting this list replaces the default list |
| `metrics.enabled` | `boolean` | `true` | Turn the Prometheus registry and the scrape path on or off |
| `metrics.path` | `string` | `/metrics` | Scrape path |
| `health.livenessPath` | `string` | `/health/live` | Process is up |
| `health.readinessPath` | `string` | `/health/ready` | Registered checks passed. `503` when one fails |

The metrics path and the two health paths have to be distinct. Each one starts with `/` and stays within 80 characters.

Environment variables: `O11Y_SERVICE_NAME`, `O11Y_SERVICE_VERSION`, `O11Y_TRACING_ENABLED`, `O11Y_EXPORTER_ENDPOINT`, `O11Y_SAMPLING_RATIO`, `O11Y_LOGGING_ENABLED`, `O11Y_LOG_LEVEL`, `O11Y_REDACT_FIELDS` (comma-separated), `O11Y_METRICS_ENABLED`, `O11Y_METRICS_PATH`, `O11Y_LIVENESS_PATH`, `O11Y_READINESS_PATH`.

The demo also reads `PORT`, `CATALOG_BASE_URL` (gateway only, default `http://127.0.0.1:3001`) and `SLOW_MS` (catalog only, default `800`).

Alert rules live in `deploy/prometheus/alerts.yml`. `HighErrorRate` fires when the 5-minute error rate stays above 5% for 2 minutes. `HighP95Latency` fires when p95 duration stays above 500ms for 2 minutes. Prometheus loads the file from the Compose stack. The rules page is http://localhost:9090/rules.

## Design

Traces go to an OpenTelemetry collector, and the collector forwards them to Jaeger. The services do not know which store is behind the collector. Changing the store is a collector config change, not an application change. The exporter speaks OTLP over HTTP. Spans are batched about once a second so a click shows up without waiting for the default five-second flush.

Sampling is parent-based. The ratio applies to a root span. If that span is kept, the child spans are kept, including the ones in the next process. The header that carries the decision is the W3C `traceparent`. HTTP instrumentation writes it on the way out and reads it on the way in. I do not set that header in application code. The gateway does forward `x-request-id`, which is a separate id: the trace id is assigned by the tracer, and the request id is the one I put in support tickets and in the log line when a trace was not sampled.

Logs are one JSON object per line. The line includes `service`, and, while a request is active, `requestId`, `traceId` and `spanId`. The span ids are read from the active span. The request id is stored for the request and copied onto the line when the response finishes, because the finish event can run after the span context has gone. Redaction walks the object that was logged. A key that matches the configured list, at any depth, is replaced with `[redacted]`. I did it that way so a nested `token` is covered without listing every dotted path.

Error rate is a counter, `http_errors_total`, next to `http_requests_total`. The rate is a Prometheus query, which is what the alert and the dashboard both use. A gauge of "current error rate" would be a second implementation of the same ratio, and it would be wrong the moment the window changed. Latency is a histogram so p95 is `histogram_quantile` over the buckets. The slow path in the demo waits 800ms, which lands above the 500ms alert threshold once the traffic has been slow for the `for` window.

Health is split on purpose. Liveness only means this process can answer, so a restart loop is not triggered by a dependency. Readiness runs the checks and returns 503 when one fails. The Compose healthchecks use liveness, so the gateway can come up as soon as it can listen; its readiness check is there for anything that should wait until the catalog answers.

## Credit / attribution

This module is authored by Krishna Das ([github.com/kr1shnadas](https://github.com/kr1shnadas)).

Anyone who uses it must give credit to Krishna Das. That covers calling it from your own service and shipping a copy or a derivative. Keep the Apache-2.0 license header on the source files (`SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Krishna Das`). Keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) intact. Section 4(d) of the Apache License 2.0 is why the NOTICE stays: a redistribution or a derivative work has to retain that file and give visible credit to Krishna Das, in the source, in the documentation that goes with it, or on a display the work normally shows.

The license remains Apache-2.0. This section does not change it.
