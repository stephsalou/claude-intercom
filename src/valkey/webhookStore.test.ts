import { test, expect } from "bun:test";
import { Redis } from "iovalkey";

const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const webhookStore = reachable ? await import("./webhookStore.ts") : null;

test.skipIf(!reachable)("registered webhook shows up in listWebhooks", async () => {
  await webhookStore!.registerWebhook("ws1", "https://example.com/hook", ["broadcast"]);
  const hooks = await webhookStore!.listWebhooks("ws1", "broadcast");
  expect(hooks.some((h) => h.url === "https://example.com/hook")).toBe(true);
});

test.skipIf(!reachable)("webhook for a different event is not returned", async () => {
  await webhookStore!.registerWebhook("ws1", "https://example.com/only-foo", ["foo"]);
  const hooks = await webhookStore!.listWebhooks("ws1", "broadcast");
  expect(hooks.some((h) => h.url === "https://example.com/only-foo")).toBe(false);
});

test.skipIf(!reachable)("webhooks are scoped by workspace", async () => {
  await webhookStore!.registerWebhook("ws-hooks-a", "https://example.com/a", ["broadcast"]);
  const hooksB = await webhookStore!.listWebhooks("ws-hooks-b", "broadcast");
  expect(hooksB.some((h) => h.url === "https://example.com/a")).toBe(false);
});

test.skipIf(reachable)("skipped: no reachable Valkey at " + url, () => {});
