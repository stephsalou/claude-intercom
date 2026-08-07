import { test, expect } from "bun:test";
import { healthStatusCode, type HealthReport } from "./health.ts";
import { Redis } from "iovalkey";

const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const report = (over: Partial<HealthReport> = {}): HealthReport => ({
  status: "ok",
  valkey: "up",
  postgres: "up",
  ...over,
});

test("a Valkey outage is a 503 — no presence, no inbox, nothing works", () => {
  expect(healthStatusCode(report({ valkey: "down", status: "degraded" }))).toBe(503);
});

test("a Postgres outage stays 200 — history breaks, messaging doesn't", () => {
  expect(healthStatusCode(report({ postgres: "down", status: "degraded" }))).toBe(200);
});

test("all up is 200", () => {
  expect(healthStatusCode(report())).toBe(200);
});

test.skipIf(!reachable)("checkHealth reports both stores against the real services", async () => {
  const { checkHealth } = await import("./health.ts");
  const result = await checkHealth();
  expect(result.valkey).toBe("up");
  expect(result.postgres).toBe("up");
  expect(result.status).toBe("ok");
});
