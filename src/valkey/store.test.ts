import { test, expect } from "bun:test";
import { Redis } from "iovalkey";

// Requires a reachable Valkey/Redis instance (VALKEY_URL, default localhost:6379).
// Run `docker compose up -d valkey` and expose port 6379 locally before running,
// or run against any local redis/valkey for dev.
const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const presence = reachable ? await import("./presenceStore.ts") : null;
const messages = reachable ? await import("./messageStore.ts") : null;

test.skipIf(!reachable)("presence register/heartbeat/expire", async () => {
  await presence!.register("t-aaaa", "demo");
  const agents = await presence!.listAgents("demo");
  expect(agents.some((a) => a.code === "t-aaaa")).toBe(true);
  expect(await presence!.heartbeat("t-aaaa")).toBe(true);
  await presence!.unregister("t-aaaa");
});

test.skipIf(!reachable)("send/peek/ack round trip via streams", async () => {
  await presence!.register("t-bbbb", "demo");
  const msg = await messages!.sendMessage("t-aaaa", "t-bbbb", "hello");
  const inbox = await messages!.peekMessages("t-bbbb");
  expect(inbox.some((m) => m.id === msg.id && m.message === "hello")).toBe(true);

  expect(await messages!.ackMessage("t-bbbb", msg.id)).toBe(true);
  const after = await messages!.peekMessages("t-bbbb");
  expect(after.some((m) => m.id === msg.id)).toBe(false);
  await presence!.unregister("t-bbbb");
});

test.skipIf(!reachable)("rejects path traversal in agent code", async () => {
  await expect(messages!.sendMessage("t-aaaa", "../../evil", "x")).rejects.toThrow();
  await expect(presence!.register("../../evil", "demo")).rejects.toThrow();
});

test.skipIf(reachable)("skipped: no reachable Valkey at " + url, () => {});
