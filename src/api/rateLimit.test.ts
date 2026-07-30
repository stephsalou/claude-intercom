import { test, expect } from "bun:test";
import { Redis } from "iovalkey";

const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const rateLimit = reachable ? await import("./rateLimit.ts") : null;
// Rate limit keys are bucketed per minute — suffix workspace names so reruns within
// the same minute don't inherit a previous run's count.
const runId = crypto.randomUUID().slice(0, 8);

test.skipIf(!reachable)("allows requests under the limit", async () => {
  for (let i = 0; i < 3; i++) {
    expect(await rateLimit!.isRateLimited(`ws-under-${runId}`, 3)).toBe(false);
  }
});

test.skipIf(!reachable)("blocks requests once the limit is exceeded", async () => {
  for (let i = 0; i < 3; i++) {
    await rateLimit!.isRateLimited(`ws-over-${runId}`, 3);
  }
  expect(await rateLimit!.isRateLimited(`ws-over-${runId}`, 3)).toBe(true);
});

test.skipIf(!reachable)("workspaces are counted independently", async () => {
  for (let i = 0; i < 3; i++) {
    await rateLimit!.isRateLimited(`ws-a-${runId}`, 3);
  }
  expect(await rateLimit!.isRateLimited(`ws-a-${runId}`, 3)).toBe(true);
  expect(await rateLimit!.isRateLimited(`ws-b-${runId}`, 3)).toBe(false);
});

test.skipIf(reachable)("skipped: no reachable Valkey at " + url, () => {});
